import type {
  AlertaCriticoUrbano,
  ChecklistItem,
  MatrizConformidadeLinha,
  StatusChecklist,
} from "@/types/gabarito";

const MAX_CHECKLIST_ITENS = 16;
const MAX_MATRIZ_LINHAS = 16;

function repairModelJsonish(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return t.replace(/\\_/g, "_");
}

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeChecklistItens(items: ChecklistItem[]): ChecklistItem[] {
  const seenRotulo = new Set<string>();
  const out: ChecklistItem[] = [];
  for (const it of items) {
    const rot = it.rotulo.trim().toLowerCase();
    if (!rot || rot === "título" || rot === "titulo") continue;
    if (seenRotulo.has(rot)) continue;
    seenRotulo.add(rot);
    const id = it.id.replace(/\s+/g, "_").slice(0, 80);
    out.push({ ...it, id });
    if (out.length >= MAX_CHECKLIST_ITENS) break;
  }
  return out;
}

function pickResumoText(
  parsed: { analise_texto?: string; divergencias_resumo?: string; resumo?: string },
  trimmed: string,
  itensLen: number,
): string {
  const at = typeof parsed.analise_texto === "string" ? parsed.analise_texto.trim() : "";
  if (at && !at.startsWith("{")) return at.slice(0, 2500);

  const legacy = typeof parsed.resumo === "string" ? parsed.resumo.trim() : "";
  if (legacy && !legacy.startsWith("{")) return legacy.slice(0, 2500);

  const fromDivergencias =
    typeof parsed.divergencias_resumo === "string" ? parsed.divergencias_resumo.trim() : "";
  if (fromDivergencias) return fromDivergencias.slice(0, 2500);

  if (itensLen > 0) return "Resumo textual indisponível; confira os itens do checklist abaixo.";

  return trimmed.length > 600 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function parseMatrizConformidade(raw: unknown): MatrizConformidadeLinha[] {
  const arr = Array.isArray(raw) ? raw : null;
  if (!arr) return [];
  const out: MatrizConformidadeLinha[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const medida =
      typeof o.medida_identificada === "string"
        ? o.medida_identificada
        : typeof o.medida === "string"
          ? o.medida
          : "";
    const regra =
      typeof o.regra_lc751 === "string"
        ? o.regra_lc751
        : typeof o.regra === "string"
          ? o.regra
          : "";
    const st =
      typeof o.status_conformidade === "string"
        ? o.status_conformidade
        : typeof o.status === "string"
          ? o.status
          : "revisar";
    const origem =
      typeof o.origem_legal === "string"
        ? o.origem_legal
        : typeof o.fonte_legal === "string"
          ? o.fonte_legal
          : typeof o.origem === "string"
            ? o.origem
            : undefined;
    if (!medida.trim() && !regra.trim()) continue;
    out.push({
      medida_identificada: medida.trim() || "—",
      regra_lc751: regra.trim() || "—",
      origem_legal: origem?.trim() || undefined,
      status_conformidade: st.trim() || "revisar",
    });
    if (out.length >= MAX_MATRIZ_LINHAS) break;
  }
  return out;
}

function toChecklistStatusFromText(s: string): ChecklistItem["status"] {
  const t = s.trim().toLowerCase();
  if (t.includes("conforme") || t.includes("aprovado")) return "conforme";
  if (t.includes("inconforme") || t.includes("crítico") || t.includes("critico")) return "inconforme";
  return "revisar";
}

function buildItensFromMatriz(matriz: MatrizConformidadeLinha[]): ChecklistItem[] {
  return normalizeChecklistItens(
    matriz.map((m, idx) => ({
      id: `matriz_${idx + 1}`,
      rotulo: m.medida_identificada || `Matriz ${idx + 1}`,
      status: toChecklistStatusFromText(m.status_conformidade),
      detalhe: m.regra_lc751 || undefined,
    })),
  );
}

function parseMatrizConformidadeFromText(raw: string): MatrizConformidadeLinha[] {
  const out: MatrizConformidadeLinha[] = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // tenta formato "medida | regra | status"
    const parts = trimmed
      .replace(/^[•\-]\s*/, "")
      .split("|")
      .map((p) => p.trim());
    if (parts.length < 3) continue;
    out.push({
      medida_identificada: parts[0] || "—",
      regra_lc751: parts[1] || "—",
      origem_legal: parts.length >= 4 ? parts[2] || undefined : undefined,
      status_conformidade: parts.length >= 4 ? parts[3] || "revisar" : parts[2] || "revisar",
    });
    if (out.length >= MAX_MATRIZ_LINHAS) break;
  }
  return out;
}

function parseAlertasCriticos(raw: unknown): AlertaCriticoUrbano[] {
  if (!Array.isArray(raw)) return [];
  const out: AlertaCriticoUrbano[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const codigo = typeof o.codigo === "string" ? o.codigo : "ALERTA";
    const titulo = typeof o.titulo === "string" ? o.titulo : "Alerta";
    const mensagem = typeof o.mensagem === "string" ? o.mensagem : "";
    const sev = o.severidade === "critico" || o.severidade === "alerta" ? o.severidade : "alerta";
    if (!mensagem) continue;
    out.push({ codigo, severidade: sev, titulo, mensagem });
  }
  return out;
}

export function parseChecklistFromModelOutput(raw: string): StatusChecklist {
  const trimmed = raw.trim();
  const candidate = repairModelJsonish(extractJsonBlock(trimmed) ?? trimmed);

  try {
    const parsed = JSON.parse(candidate) as {
      analise_texto?: string;
      resumo?: string;
      divergencias_resumo?: string;
      itens?: unknown;
      divergencias?: unknown;
      matriz_conformidade?: unknown;
      matriz?: unknown;
      area_construida_estimada_ia_m2?: unknown;
      area_construida_estimada_m2?: unknown;
      inferencia_area_potencial_risco?: unknown;
      inferencia_cota_enchente_12m?: unknown;
      inferencia_uso_residencial?: unknown;
      otimizacao_sugestao_ia?: unknown;
      parecer_tecnico_llama?: unknown;
      alertas_criticos?: unknown;
    };

    const fromDivergencias = (div: unknown): ChecklistItem[] => {
      if (!Array.isArray(div)) return [];
      return div
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const o = row as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id : "divergencia";
          const rotulo =
            typeof o.rotulo === "string"
              ? o.rotulo
              : typeof o.regra === "string"
                ? o.regra
                : typeof o.titulo === "string"
                  ? o.titulo
                  : "Verificação";
          const detalhe =
            typeof o.detalhe === "string"
              ? o.detalhe
              : typeof o.descricao === "string"
                ? o.descricao
                : undefined;
          if (typeof o.conforme === "boolean") {
            const status: ChecklistItem["status"] = o.conforme ? "conforme" : "inconforme";
            return { id, rotulo, status, detalhe };
          }
          const st =
            o.status === "conforme" || o.status === "inconforme" || o.status === "revisar"
              ? o.status
              : "revisar";
          return { id, rotulo, status: st, detalhe };
        })
        .filter(Boolean) as ChecklistItem[];
    };

    const itensFromDivergencias = fromDivergencias(parsed.divergencias);
    const itensRaw = Array.isArray(parsed.itens) ? parsed.itens : [];
    const itensFromLegacy: ChecklistItem[] = itensRaw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "item";
        const rotulo = typeof o.rotulo === "string" ? o.rotulo : "Item";
        const st =
          o.status === "conforme" || o.status === "inconforme" || o.status === "revisar"
            ? o.status
            : "revisar";
        const detalhe = typeof o.detalhe === "string" ? o.detalhe : undefined;
        return { id, rotulo, status: st, detalhe };
      })
      .filter(Boolean) as ChecklistItem[];

    const itensRawMerged =
      itensFromDivergencias.length > 0 ? itensFromDivergencias : itensFromLegacy;
    let itens = normalizeChecklistItens(itensRawMerged);

    const divergencias_resumo =
      typeof parsed.divergencias_resumo === "string" ? parsed.divergencias_resumo.trim() : undefined;

    const analise_bruta = pickResumoText(parsed, trimmed, itens.length);

    const matrizPrim = parseMatrizConformidade(parsed.matriz_conformidade);
    const matriz_conformidade =
      matrizPrim.length > 0 ? matrizPrim : parseMatrizConformidade(parsed.matriz);
    let modoFallback = false;
    if (itens.length === 0 && matriz_conformidade.length > 0) {
      itens = buildItensFromMatriz(matriz_conformidade);
      modoFallback = itens.length > 0;
    }

    const area_construida_estimada_ia_m2 =
      numOrNull(parsed.area_construida_estimada_ia_m2) ?? numOrNull(parsed.area_construida_estimada_m2);

    const inferencia_area_potencial_risco = boolOrNull(parsed.inferencia_area_potencial_risco);
    const inferencia_cota_enchente_12m = boolOrNull(parsed.inferencia_cota_enchente_12m);
    const inferencia_uso_residencial = boolOrNull(parsed.inferencia_uso_residencial);

    const otimizacao_sugestao_ia =
      typeof parsed.otimizacao_sugestao_ia === "string" ? parsed.otimizacao_sugestao_ia.trim() : undefined;

    const parecer_tecnico_llama =
      typeof parsed.parecer_tecnico_llama === "string" ? parsed.parecer_tecnico_llama.trim() : undefined;

    const alertas_criticos = parseAlertasCriticos(parsed.alertas_criticos);

    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      modo_fallback: modoFallback,
      itens,
      analise_bruta,
      divergencias_resumo: divergencias_resumo || undefined,
      matriz_conformidade: matriz_conformidade.length ? matriz_conformidade : undefined,
      area_construida_estimada_ia_m2,
      inferencia_area_potencial_risco,
      inferencia_cota_enchente_12m,
      inferencia_uso_residencial,
      otimizacao_sugestao_ia,
      parecer_tecnico_llama: parecer_tecnico_llama || undefined,
      alertas_criticos: alertas_criticos.length ? alertas_criticos : undefined,
    };
  } catch {
    const matrizTextual = parseMatrizConformidadeFromText(trimmed);
    const itensFallback = buildItensFromMatriz(matrizTextual);
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      modo_fallback: true,
      itens: itensFallback,
      matriz_conformidade: matrizTextual.length ? matrizTextual : undefined,
      analise_bruta: trimmed.length > 600 ? `${trimmed.slice(0, 500)}…` : trimmed,
      divergencias_resumo:
        itensFallback.length > 0
          ? "Retorno parcialmente estruturado por fallback textual; revise itens e matriz antes de protocolar."
          : "Não foi possível estruturar o retorno do modelo; use o bloco técnico abaixo se precisar do texto integral.",
    };
  }
}
