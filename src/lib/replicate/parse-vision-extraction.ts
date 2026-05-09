import type { ExtracaoVisaoLlama } from "@/types/gabarito";

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseVisionExtraction(raw: string): ExtracaoVisaoLlama | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const block = extractJsonBlock(trimmed) ?? trimmed;
  try {
    const o = JSON.parse(block) as Record<string, unknown>;
    const uso = typeof o.uso_predominante_planta === "string" ? o.uso_predominante_planta.trim() : "Indeterminado";
    const totalExplicit = numOrNull(o.area_construida_total_m2);
    const legacyEst = numOrNull(o.area_construida_estimada_m2);
    const projecao = numOrNull(o.area_projecao_horizontal_m2);
    return {
      area_construida_total_m2: totalExplicit ?? legacyEst,
      area_projecao_horizontal_m2: projecao,
      area_construida_estimada_m2: totalExplicit ?? legacyEst,
      taxa_ocupacao_estimada_pct: numOrNull(o.taxa_ocupacao_estimada_pct),
      recuo_frontal_m: numOrNull(o.recuo_frontal_m),
      recuo_lateral_m: numOrNull(o.recuo_lateral_m),
      recuo_fundos_m: numOrNull(o.recuo_fundos_m),
      altura_edificacao_estimada_m: numOrNull(o.altura_edificacao_estimada_m),
      area_permeavel_estimada_m2: numOrNull(o.area_permeavel_estimada_m2),
      uso_predominante_planta: uso || "Indeterminado",
      observacoes_extracao: typeof o.observacoes_extracao === "string" ? o.observacoes_extracao.trim() : "",
    };
  } catch {
    return null;
  }
}
