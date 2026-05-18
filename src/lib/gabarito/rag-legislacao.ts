import { getLc751LeiTextoParaChatLlm } from "@/lib/gabarito/lc751-chat-reference";
import { createServiceSupabase } from "@/lib/supabase/service";

export type DocumentoLegislacaoMatch = {
  id: string;
  nome_lei: string;
  artigo: string | null;
  conteudo: string;
  similarity: number;
};

type DocumentoLegislacaoRow = Omit<DocumentoLegislacaoMatch, "similarity"> & {
  embedding: unknown;
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_REPLICATE_EMBEDDING_MODEL = "nateraw/bge-large-en-v1.5";
const DEFAULT_REPLICATE_EMBEDDING_VERSION = "9cf9f015a9cb9c61d1a2610659cdac4a4ca222f2d3707a68517b18c198a9add1";
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_MATCH_COUNT = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.60;

function fitEmbeddingDimensions(embedding: number[]): number[] | null {
  if (embedding.length === EMBEDDING_DIMENSIONS) {
    return embedding;
  }

  if (embedding.length === 0) {
    return null;
  }

  console.warn(
    `[rag-legislacao] Embedding com ${embedding.length} dimensões; ajustando para ${EMBEDDING_DIMENSIONS}.`,
  );
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS);
  }
  return embedding.concat(Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0));
}

function firstNumericVector(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => typeof item === "number")) {
      return value as number[];
    }

    for (const item of value) {
      const found = firstNumericVector(item);
      if (found) return found;
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["embedding", "embeddings", "data", "output"]) {
      const found = firstNumericVector(record[key]);
      if (found) return found;
    }

    for (const item of Object.values(record)) {
      const found = firstNumericVector(item);
      if (found) return found;
    }
  }

  return null;
}

async function createOpenAiQueryEmbedding(input: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[rag-legislacao] OPENAI_API_KEY ausente; usando fallback estático da LC 751/zoneamento.",
    );
    return null;
  }

  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: input.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(
      `[rag-legislacao] Falha ao gerar embedding (${res.status}). Usando fallback. ${detail.slice(0, 300)}`,
    );
    return null;
  }

  const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    console.warn(
      "[rag-legislacao] Embedding inválido: null dimensões.",
    );
    return null;
  }
  return fitEmbeddingDimensions(embedding);
}

function createReplicateInput(input: string): Record<string, unknown> {
  const key = process.env.REPLICATE_EMBEDDING_INPUT_KEY?.trim() || "texts";
  const format = process.env.REPLICATE_EMBEDDING_INPUT_FORMAT?.trim() || "json-array";
  const clipped = input.slice(0, 8000);

  if (format === "string") {
    return { [key]: clipped };
  }
  if (format === "array") {
    return { [key]: [clipped] };
  }
  return { [key]: JSON.stringify([clipped]) };
}

async function waitReplicatePrediction(prediction: Record<string, unknown>, token: string): Promise<Record<string, unknown>> {
  let current = prediction;
  let status = String(current.status || "");
  const urls = current.urls as { get?: string } | undefined;

  for (let attempt = 0; status && !["succeeded", "failed", "canceled"].includes(status) && attempt < 60; attempt += 1) {
    if (!urls?.get) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await fetch(urls.get, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Replicate polling falhou (${res.status}): ${detail.slice(0, 300)}`);
    }

    current = (await res.json()) as Record<string, unknown>;
    status = String(current.status || "");
  }

  if (status !== "succeeded") {
    throw new Error(`Replicate prediction não concluiu com sucesso: ${status} ${String(current.error || "")}`);
  }
  return current;
}

async function createReplicateQueryEmbedding(input: string): Promise<number[] | null> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    console.warn(
      "[rag-legislacao] REPLICATE_API_TOKEN ausente; usando fallback estático da LC 751/zoneamento.",
    );
    return null;
  }

  const version = process.env.REPLICATE_EMBEDDING_VERSION?.trim() || DEFAULT_REPLICATE_EMBEDDING_VERSION;
  const model = process.env.REPLICATE_EMBEDDING_MODEL?.trim() || DEFAULT_REPLICATE_EMBEDDING_MODEL;
  const body: Record<string, unknown> = {
    input: createReplicateInput(input),
  };

  let url = `https://api.replicate.com/v1/models/${model}/predictions`;
  if (version) {
    url = "https://api.replicate.com/v1/predictions";
    body.version = version;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(
      `[rag-legislacao] Falha ao gerar embedding no Replicate (${res.status}). Usando fallback. ${detail.slice(0, 300)}`,
    );
    return null;
  }

  const prediction = await waitReplicatePrediction((await res.json()) as Record<string, unknown>, token);
  const embedding = firstNumericVector(prediction.output);
  if (!embedding) {
    console.warn("[rag-legislacao] Saída do Replicate não contém embedding numérico; usando fallback estático.");
    return null;
  }
  return fitEmbeddingDimensions(embedding);
}

async function createQueryEmbedding(input: string): Promise<number[] | null> {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase()
    || (process.env.REPLICATE_API_TOKEN?.trim() && !process.env.OPENAI_API_KEY?.trim() ? "replicate" : "openai");

  if (provider === "replicate") {
    return createReplicateQueryEmbedding(input);
  }
  return createOpenAiQueryEmbedding(input);
}

function parseStoredEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((item) => Number(item.trim()));
    return parsed.length > 0 && parsed.every(Number.isFinite) ? parsed : null;
  }

  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let idx = 0; idx < length; idx += 1) {
    dot += a[idx] * b[idx];
    normA += a[idx] * a[idx];
    normB += b[idx] * b[idx];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function matchDocumentosInMemory(
  queryEmbedding: number[],
  options?: {
    matchCount?: number;
    similarityThreshold?: number;
  },
): Promise<DocumentoLegislacaoMatch[] | null> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("documentos_legislacao")
    .select("id,nome_lei,artigo,conteudo,embedding")
    .limit(500);

  if (error) {
    console.warn("[rag-legislacao] Fallback local de similaridade falhou.", error.message);
    return null;
  }

  const threshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  return ((data ?? []) as DocumentoLegislacaoRow[])
    .map((row) => {
      const storedEmbedding = parseStoredEmbedding(row.embedding);
      if (!storedEmbedding) {
        return null;
      }
      return {
        id: row.id,
        nome_lei: row.nome_lei,
        artigo: row.artigo,
        conteudo: row.conteudo,
        similarity: cosineSimilarity(queryEmbedding, storedEmbedding),
      };
    })
    .filter((row): row is DocumentoLegislacaoMatch => row !== null && row.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(1, options?.matchCount ?? DEFAULT_MATCH_COUNT));
}

function formatMatches(matches: DocumentoLegislacaoMatch[]): string {
  return matches
    .map((m, idx) => {
      const ref = [m.nome_lei, m.artigo].filter(Boolean).join(" - ");
      return [
        `Trecho ${idx + 1} (${ref || "Documento legal"}, similaridade ${m.similarity.toFixed(3)}):`,
        m.conteudo.trim(),
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export async function getLegislacaoRagContext(query: string, options?: {
  matchCount?: number;
  similarityThreshold?: number;
}): Promise<{
  context: string;
  matches: DocumentoLegislacaoMatch[];
  source: "rag" | "fallback";
}> {
  const embedding = await createQueryEmbedding(query);
  if (!embedding) {
    return { context: getLc751LeiTextoParaChatLlm(), matches: [], source: "fallback" };
  }

  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase.rpc("match_documentos_legislacao", {
      query_embedding: embedding,
      match_count: options?.matchCount ?? DEFAULT_MATCH_COUNT,
      similarity_threshold: options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
    });

    if (error) {
      console.warn(
        "[rag-legislacao] RPC match_documentos_legislacao falhou; tentando similaridade local.",
        error.message,
      );
      const localMatches = await matchDocumentosInMemory(embedding, options);
      if (localMatches && localMatches.length > 0) {
        return {
          context: formatMatches(localMatches),
          matches: localMatches,
          source: "rag",
        };
      }
      return { context: getLc751LeiTextoParaChatLlm(), matches: [], source: "fallback" };
    }

    const matches = (Array.isArray(data) ? data : []) as DocumentoLegislacaoMatch[];
    const usable = matches.filter((m) => m.conteudo?.trim());
    if (usable.length === 0) {
      console.warn("[rag-legislacao] documentos_legislacao vazia/sem matches; usando fallback estático.");
      return { context: getLc751LeiTextoParaChatLlm(), matches: [], source: "fallback" };
    }

    return {
      context: formatMatches(usable),
      matches: usable,
      source: "rag",
    };
  } catch (e) {
    console.warn("[rag-legislacao] Erro inesperado no RAG; usando fallback estático.", e);
    return { context: getLc751LeiTextoParaChatLlm(), matches: [], source: "fallback" };
  }
}
