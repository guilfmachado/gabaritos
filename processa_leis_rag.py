#!/usr/bin/env python3
"""
Ingestão RAG das leis de Blumenau para a tabela `documentos_legislacao`.

Uso:
  1. Crie a pasta `leis_blumenau/` na raiz do projeto.
  2. Coloque os PDFs ou transcrições .txt/.md:
     - Plano Diretor / LC 1181/2018
     - Código de Parcelamento / LC 749/2010
     - Código Ambiental / LC 747/2010
  3. Configure:
     export SUPABASE_SERVICE_ROLE_KEY="..."
     export EMBEDDING_PROVIDER="replicate"
     export REPLICATE_API_TOKEN="..."
  4. Rode:
     python processa_leis_rag.py

Dependências:
  pip install pypdf requests
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Dependência ausente: instale com `pip install pypdf requests`."
    ) from exc


SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tbcsikyivleuvindyhjy.supabase.co").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small").strip()
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "").strip()
REPLICATE_EMBEDDING_MODEL = os.getenv("REPLICATE_EMBEDDING_MODEL", "nateraw/bge-large-en-v1.5").strip()
REPLICATE_EMBEDDING_VERSION = os.getenv(
    "REPLICATE_EMBEDDING_VERSION",
    "9cf9f015a9cb9c61d1a2610659cdac4a4ca222f2d3707a68517b18c198a9add1",
).strip()
REPLICATE_EMBEDDING_INPUT_KEY = os.getenv("REPLICATE_EMBEDDING_INPUT_KEY", "texts").strip()
REPLICATE_EMBEDDING_INPUT_FORMAT = os.getenv("REPLICATE_EMBEDDING_INPUT_FORMAT", "json-array").strip()
EMBEDDING_PROVIDER = os.getenv(
    "EMBEDDING_PROVIDER",
    "replicate" if REPLICATE_API_TOKEN and not OPENAI_API_KEY else "openai",
).strip().lower()
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
_WARNED_DIMENSIONS: set[int] = set()
_SUPABASE_SUPPORTS_METADATA = True

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_LEIS_DIR = PROJECT_ROOT / "leis_blumenau"

# Reconhece cabeçalhos reais de artigo, inclusive Art. 1º, Art 35-A, Art. 41, I.
# Usa início de linha para evitar dividir referências internas como "conforme Art. 35".
ARTIGO_HEADER_RE = re.compile(
    r"(?im)^\s*(Art\.?\s*\d+[º°]?(?:\s*[-–—]\s*[A-Za-z])?(?:\s*,\s*[IVXLCDM]+)?)\s*[\.\-–—:]?\s+",
)

LEI_MAP = [
    {
        "nome_lei": "Plano Diretor - LC 1181/2018",
        "patterns": [r"1181", r"plano[\s_-]*diretor", r"pdm"],
    },
    {
        "nome_lei": "Código de Edificações - LC 1247/2019",
        "patterns": [r"1247", r"edificacoes", r"edificações", r"codigo[\s_-]*de[\s_-]*edific"],
    },
    {
        "nome_lei": "Código de Parcelamento - LC 749/2010",
        "patterns": [r"749", r"parcelamento"],
    },
    {
        "nome_lei": "Código Ambiental - LC 747/2010",
        "patterns": [r"747", r"ambiental", r"meio[\s_-]*ambiente"],
    },
    {
        "nome_lei": "Código do Sistema de Circulação - LC 748/2010",
        "patterns": [r"748", r"sistema[\s_-]*de[\s_-]*circulacao", r"sistema[\s_-]*de[\s_-]*circulação"],
    },
    {
        "nome_lei": "LC 751/2010 - Zoneamento",
        "patterns": [r"751", r"zoneamento", r"uso[\s_-]*do[\s_-]*solo"],
    },
    {
        "nome_lei": "Decreto 9155/2010 - Vias Existentes e Projetadas",
        "patterns": [r"9155", r"vias[\s_-]*(existentes|projetadas)", r"sistema[\s_-]*viario"],
    },
]


@dataclass(frozen=True)
class ArtigoChunk:
    nome_lei: str
    artigo: str
    conteudo: str
    arquivo: str
    ordem: int


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def classify_nome_lei(pdf_path: Path) -> str:
    haystack = strip_accents(pdf_path.name.lower())
    for item in LEI_MAP:
        if any(re.search(pattern, haystack, flags=re.I) for pattern in item["patterns"]):
            return item["nome_lei"]
    return f"Lei Municipal - {pdf_path.stem}"


def normalize_pdf_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Em alguns PDFs o extrator junta "Art. 12" no meio da linha; só quebramos quando
    # parece início real de artigo (após ponto final, ponto e vírgula ou página).
    text = re.sub(
        r"(?<!^)(?<!\n)(?P<prefix>[.;])\s+(?P<header>Art\.?\s*\d+[º°]?(?:\s*[-–—]\s*[A-Za-z])?(?:\s*,\s*[IVXLCDM]+)?\s*[\.\-–—:]?\s+)",
        lambda m: f"{m.group('prefix')}\n{m.group('header')}",
        text,
        flags=re.I,
    )
    return text.strip()


def read_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            extracted = page.extract_text() or ""
        except Exception as exc:
            print(f"[warn] Falha ao extrair página {i} de {pdf_path.name}: {exc}", file=sys.stderr)
            extracted = ""
        if extracted.strip():
            pages.append(extracted)
    return normalize_pdf_text("\n\n".join(pages))


def read_legal_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return read_pdf_text(path)
    if path.suffix.lower() in {".txt", ".md"}:
        return normalize_pdf_text(path.read_text(encoding="utf-8"))
    raise ValueError(f"Formato não suportado: {path.suffix}")


def canonical_artigo(raw: str) -> str:
    raw = re.sub(r"\s+", " ", raw.strip())
    raw = raw.replace("Art ", "Art. ")
    return raw.rstrip(".:-–— ")


def split_artigos(nome_lei: str, pdf_path: Path, text: str) -> list[ArtigoChunk]:
    matches = list(ARTIGO_HEADER_RE.finditer(text))
    chunks: list[ArtigoChunk] = []

    if not matches:
        # Fallback: chunk único quando o PDF não preserva cabeçalhos.
        return [
            ArtigoChunk(
                nome_lei=nome_lei,
                artigo="Documento completo",
                conteudo=text[:12000],
                arquivo=pdf_path.name,
                ordem=1,
            )
        ]

    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        artigo = canonical_artigo(match.group(1))

        # Evita artigos muito curtos criados por ruído de OCR.
        if len(chunk) < 80:
            continue

        chunks.append(
            ArtigoChunk(
                nome_lei=nome_lei,
                artigo=artigo,
                conteudo=chunk,
                arquivo=pdf_path.name,
                ordem=len(chunks) + 1,
            )
        )

    return chunks


def iter_legal_sources(leis_dir: Path) -> Iterable[Path]:
    for pattern in ("*.pdf", "*.txt", "*.md"):
        yield from sorted(leis_dir.glob(pattern))


def source_priority(path: Path) -> tuple[int, str]:
    name = strip_accents(path.name.lower())
    is_transcription = path.suffix.lower() in {".txt", ".md"} or "transcricao" in name or "transcrição" in name
    # Transcrições revisadas pelo usuário têm prioridade sobre PDF extraído automaticamente.
    return (0 if is_transcription else 1, path.name.lower())


def select_preferred_sources(sources: list[Path]) -> list[Path]:
    by_law: dict[str, Path] = {}
    for source in sorted(sources, key=source_priority):
        nome_lei = classify_nome_lei(source)
        by_law.setdefault(nome_lei, source)
    return list(by_law.values())


def openai_embedding(text: str) -> list[float]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY não configurada.")

    res = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        data=json.dumps(
            {
                "model": OPENAI_EMBEDDING_MODEL,
                "input": text[:8000],
            }
        ),
        timeout=60,
    )
    if not res.ok:
        raise RuntimeError(f"OpenAI embeddings falhou ({res.status_code}): {res.text[:500]}")
    payload = res.json()
    embedding = payload["data"][0]["embedding"]
    return fit_embedding_dimensions(embedding)


def fit_embedding_dimensions(embedding: list[float]) -> list[float]:
    original_len = len(embedding)
    if original_len == EMBEDDING_DIMENSIONS:
        return [float(value) for value in embedding]

    if original_len not in _WARNED_DIMENSIONS:
        print(
            f"[warn] Embedding com {original_len} dimensões; ajustando para "
            f"{EMBEDDING_DIMENSIONS} para compatibilidade com documentos_legislacao.",
            file=sys.stderr,
        )
        _WARNED_DIMENSIONS.add(original_len)

    values = [float(value) for value in embedding[:EMBEDDING_DIMENSIONS]]
    if len(values) < EMBEDDING_DIMENSIONS:
        values.extend([0.0] * (EMBEDDING_DIMENSIONS - len(values)))
    return values


def first_numeric_vector(value: object) -> list[float] | None:
    if isinstance(value, list):
        if value and all(isinstance(item, (int, float)) for item in value):
            return [float(item) for item in value]
        for item in value:
            found = first_numeric_vector(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("embedding", "embeddings", "data", "output"):
            found = first_numeric_vector(value.get(key))
            if found:
                return found
        for item in value.values():
            found = first_numeric_vector(item)
            if found:
                return found
    return None


def numeric_vectors(value: object) -> list[list[float]]:
    vectors: list[list[float]] = []

    def visit(item: object) -> None:
        if isinstance(item, list):
            if item and all(isinstance(value, (int, float)) for value in item):
                vectors.append([float(value) for value in item])
                return
            for child in item:
                visit(child)
            return
        if isinstance(item, dict):
            for key in ("embedding", "embeddings", "data", "output"):
                if key in item:
                    visit(item[key])
            if not vectors:
                for child in item.values():
                    visit(child)

    visit(value)
    return vectors


def replicate_input(text: str) -> dict[str, object]:
    return replicate_inputs([text])


def replicate_inputs(texts: list[str]) -> dict[str, object]:
    clipped = [text[:8000] for text in texts]
    if REPLICATE_EMBEDDING_INPUT_FORMAT == "string":
        if len(clipped) != 1:
            raise RuntimeError("REPLICATE_EMBEDDING_INPUT_FORMAT=string não suporta lote.")
        value: object = clipped[0]
    elif REPLICATE_EMBEDDING_INPUT_FORMAT == "array":
        value = clipped
    else:
        # O modelo BGE no Replicate espera uma lista serializada em JSON.
        value = json.dumps(clipped, ensure_ascii=False)
    return {REPLICATE_EMBEDDING_INPUT_KEY: value}


def create_replicate_prediction(texts: list[str]) -> dict[str, object]:
    headers = {
        "Authorization": f"Token {REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait=60",
    }
    body: dict[str, object] = {"input": replicate_inputs(texts)}

    if REPLICATE_EMBEDDING_VERSION:
        url = "https://api.replicate.com/v1/predictions"
        body["version"] = REPLICATE_EMBEDDING_VERSION
    else:
        if "/" not in REPLICATE_EMBEDDING_MODEL:
            raise RuntimeError("REPLICATE_EMBEDDING_MODEL deve estar no formato owner/model.")
        url = f"https://api.replicate.com/v1/models/{REPLICATE_EMBEDDING_MODEL}/predictions"

    res = requests.post(url, headers=headers, data=json.dumps(body), timeout=90)
    if not res.ok:
        raise RuntimeError(f"Replicate embeddings falhou ({res.status_code}): {res.text[:500]}")
    return res.json()


def wait_replicate_prediction(prediction: dict[str, object]) -> dict[str, object]:
    status = str(prediction.get("status") or "")
    get_url = prediction.get("urls", {}).get("get") if isinstance(prediction.get("urls"), dict) else None

    while status not in {"succeeded", "failed", "canceled"}:
        if not get_url:
            break
        time.sleep(1)
        res = requests.get(
            str(get_url),
            headers={"Authorization": f"Token {REPLICATE_API_TOKEN}"},
            timeout=60,
        )
        if not res.ok:
            raise RuntimeError(f"Replicate polling falhou ({res.status_code}): {res.text[:500]}")
        prediction = res.json()
        status = str(prediction.get("status") or "")

    if status != "succeeded":
        raise RuntimeError(f"Replicate prediction não concluiu com sucesso: {status} {prediction.get('error') or ''}")
    return prediction


def replicate_embedding(text: str) -> list[float]:
    return replicate_embeddings([text])[0]


def replicate_embeddings(texts: list[str]) -> list[list[float]]:
    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN não configurada.")

    prediction = wait_replicate_prediction(create_replicate_prediction(texts))
    embeddings = numeric_vectors(prediction.get("output"))
    if not embeddings:
        raise RuntimeError(f"Saída do Replicate não contém embedding numérico: {str(prediction.get('output'))[:500]}")
    if len(embeddings) != len(texts):
        raise RuntimeError(f"Replicate retornou {len(embeddings)} embedding(s), esperado {len(texts)}.")
    return [fit_embedding_dimensions(embedding) for embedding in embeddings]


def create_embedding(text: str) -> list[float]:
    if EMBEDDING_PROVIDER == "replicate":
        return replicate_embedding(text)
    if EMBEDDING_PROVIDER == "openai":
        return openai_embedding(text)
    raise RuntimeError("EMBEDDING_PROVIDER deve ser 'replicate' ou 'openai'.")


def create_embeddings(texts: list[str], batch_size: int = 16) -> list[list[float]]:
    if EMBEDDING_PROVIDER == "replicate":
        embeddings: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            print(f"[embedding] Replicate lote {start + 1}-{start + len(batch)} de {len(texts)}")
            embeddings.extend(replicate_embeddings(batch))
        return embeddings
    return [openai_embedding(text) for text in texts]


def upsert_documento(chunk: ArtigoChunk, embedding: list[float], dry_run: bool = False) -> None:
    global _SUPABASE_SUPPORTS_METADATA

    if dry_run:
        print(f"[dry-run] {chunk.nome_lei} | {chunk.artigo} | {len(chunk.conteudo)} chars")
        return

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurada.")

    url = f"{SUPABASE_URL}/rest/v1/documentos_legislacao"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    body = {
        "nome_lei": chunk.nome_lei,
        "artigo": chunk.artigo,
        "conteudo": chunk.conteudo,
        "embedding": embedding,
    }
    if _SUPABASE_SUPPORTS_METADATA:
        body["metadata"] = {
            "arquivo": chunk.arquivo,
            "ordem": chunk.ordem,
            "pipeline": "processa_leis_rag.py",
        }
    res = requests.post(url, headers=headers, data=json.dumps(body), timeout=60)
    if (
        not res.ok
        and res.status_code == 400
        and _SUPABASE_SUPPORTS_METADATA
        and "metadata" in res.text
    ):
        _SUPABASE_SUPPORTS_METADATA = False
        print("[warn] Coluna metadata ausente no Supabase remoto; inserindo documentos sem metadata.", file=sys.stderr)
        body.pop("metadata", None)
        res = requests.post(url, headers=headers, data=json.dumps(body), timeout=60)
    if not res.ok:
        raise RuntimeError(f"Supabase insert falhou ({res.status_code}): {res.text[:500]}")


def delete_documentos_legislacao(nome_leis: Iterable[str], dry_run: bool = False) -> None:
    names = sorted(set(nome_leis))
    if dry_run:
        print(f"[dry-run] replace removeria documentos de: {', '.join(names)}")
        return

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurada.")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Prefer": "return=minimal",
    }
    for nome_lei in names:
        res = requests.delete(
            f"{SUPABASE_URL}/rest/v1/documentos_legislacao",
            headers=headers,
            params={"nome_lei": f"eq.{nome_lei}"},
            timeout=60,
        )
        if not res.ok:
            raise RuntimeError(f"Supabase delete falhou ({res.status_code}): {res.text[:500]}")
        print(f"[replace] registros antigos removidos: {nome_lei}")


def processar(
    leis_dir: Path,
    dry_run: bool = False,
    sleep_s: float = 0.15,
    replace: bool = False,
    batch_size: int = 16,
) -> None:
    sources = select_preferred_sources(list(iter_legal_sources(leis_dir)))
    if not sources:
        raise SystemExit(f"Nenhum PDF/TXT/MD encontrado em {leis_dir}. Crie a pasta e adicione os arquivos.")

    if replace:
        delete_documentos_legislacao((classify_nome_lei(source) for source in sources), dry_run=dry_run)

    total = 0
    for source_path in sources:
        nome_lei = classify_nome_lei(source_path)
        print(f"\n[fonte] {source_path.name} -> {nome_lei}")
        text = read_legal_text(source_path)
        chunks = split_artigos(nome_lei, source_path, text)
        print(f"[split] {len(chunks)} artigo(s)/chunk(s)")

        texts = [f"{chunk.nome_lei}\n{chunk.artigo}\n{chunk.conteudo}" for chunk in chunks]
        embeddings = [[0.0] * EMBEDDING_DIMENSIONS for _ in chunks] if dry_run else create_embeddings(
            texts,
            batch_size=batch_size,
        )

        for chunk, embedding in zip(chunks, embeddings, strict=True):
            upsert_documento(chunk, embedding, dry_run=dry_run)
            total += 1
            print(f"  ✓ {chunk.artigo} ({len(chunk.conteudo)} chars)")
            if not dry_run and sleep_s > 0:
                time.sleep(sleep_s)

    print(f"\n[ok] Processados {total} chunk(s) em documentos_legislacao.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Processa PDFs legais de Blumenau para RAG no Supabase.")
    parser.add_argument("--dir", default=str(DEFAULT_LEIS_DIR), help="Pasta com PDFs (default: leis_blumenau).")
    parser.add_argument("--dry-run", action="store_true", help="Não chama embeddings nem Supabase; apenas valida split.")
    parser.add_argument("--replace", action="store_true", help="Remove documentos existentes das mesmas leis antes de inserir.")
    parser.add_argument("--sleep", type=float, default=0.15, help="Pausa entre embeddings/inserts.")
    parser.add_argument("--batch-size", type=int, default=16, help="Quantidade de textos por chamada de embedding em lote.")
    args = parser.parse_args()

    processar(
        Path(args.dir).resolve(),
        dry_run=args.dry_run,
        sleep_s=args.sleep,
        replace=args.replace,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
