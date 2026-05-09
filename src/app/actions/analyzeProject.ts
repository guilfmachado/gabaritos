"use server";

import { mapChecklistToPlantaAnaliseIA } from "@/lib/gabarito/map-checklist-to-planta-ia";
import { computeMetricasTerreno } from "@/lib/gabarito/metricas-terreno";
import { coerceNormaLocal } from "@/lib/gabarito/norma-coerce";
import { composeUltimaAnaliseIa, insertProjetoAnaliseSnapshot } from "@/lib/gabarito/persist-analise-projeto";
import { analyzePlantaVision } from "@/lib/replicate/analyze-planta";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NORMAS_LOCAIS_COLUMNS, type NormaLocal, type PlantaAnaliseIA, type StatusChecklist } from "@/types/gabarito";

const MAX_BYTES = 10 * 1024 * 1024;
const FORM_FIELD = "file";
const ZONA_FIELD = "zona_urbanistica";
const NOME_PROJETO_FIELD = "nome_projeto";
const NOME_FIELD = "nome";
/** Campo principal no FormData; `area_terreno_m2` mantido para compatibilidade. */
const AREA_TERRENO_KEYS = ["area_terreno", "area_terreno_m2"] as const;
const USER_ID_FIELD = "user_id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AnalyzeProjectSuccess = {
  ok: true;
  data: PlantaAnaliseIA;
  raw: string;
  checklist?: StatusChecklist;
  ultima_analise_ia?: string;
  persistError?: string;
  projeto_id?: string;
  area_terreno_m2?: number;
  area_restante_potencial_m2?: number | null;
};

export type AnalyzeProjectFailure = {
  ok: false;
  error: string;
};

export type AnalyzeProjectResult = AnalyzeProjectSuccess | AnalyzeProjectFailure;

/** @deprecated use PlantaAnaliseIA from @/types/gabarito */
export type ProjectAnalysisData = PlantaAnaliseIA;

export type { PlantaAnaliseIA } from "@/types/gabarito";

function parseAreaTerrenoFromForm(formData: FormData): number | undefined {
  for (const key of AREA_TERRENO_KEYS) {
    const raw = formData.get(key);
    if (raw == null || typeof raw !== "string") continue;
    const t = raw.trim().replace(",", ".");
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

async function loadZonaNormasCompleta(zona: string): Promise<NormaLocal | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("normas_locais")
      .select(NORMAS_LOCAIS_COLUMNS)
      .eq("zona_urbanistica", zona)
      .maybeSingle();

    if (error || !data) return null;
    return coerceNormaLocal(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function analyzeProject(formData: FormData): Promise<AnalyzeProjectResult> {
  try {
    const entry = formData.get(FORM_FIELD);
    if (!entry || typeof entry === "string") {
      return { ok: false, error: "Nenhum arquivo enviado. Use o campo \"file\" no FormData." };
    }

    const file = entry as File;
    if (file.size === 0) return { ok: false, error: "Arquivo vazio." };
    if (file.size > MAX_BYTES) return { ok: false, error: "Arquivo acima do limite de 10MB." };

    const mime = file.type || "application/octet-stream";
    if (mime !== "image/png" && mime !== "image/jpeg") {
      return { ok: false, error: "Envie PNG ou JPG para análise por visão." };
    }

    const zonaRaw = formData.get(ZONA_FIELD);
    const zona =
      typeof zonaRaw === "string" && zonaRaw.trim() ? zonaRaw.trim() : "ZR1";

    const norma = await loadZonaNormasCompleta(zona);
    if (!norma) {
      return {
        ok: false,
        error: `Não foi possível carregar normas para a zona "${zona}". Verifique normas_locais.`,
      };
    }

    const areaTerrenoM2 = parseAreaTerrenoFromForm(formData);
    if (areaTerrenoM2 == null) {
      return {
        ok: false,
        error: "Informe a área do terreno em m² (campo obrigatório: area_terreno).",
      };
    }

    const metricasPrecomputadas = computeMetricasTerreno(areaTerrenoM2, norma);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    let rawOutput: string;
    let checklist: StatusChecklist;
    let visionRaw = "";
    let auditRaw = "";
    try {
      const out = await analyzePlantaVision({
        imageBase64: base64,
        mimeType: mime,
        zona,
        norma,
        areaTerrenoM2,
        metricasPrecomputadas,
      });
      rawOutput = out.rawOutput;
      checklist = out.checklist;
      visionRaw = out.visionRaw;
      auditRaw = out.auditRaw;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha na integração com a Replicate.";
      if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
        return { ok: false, error: "Tempo esgotado na análise. Tente de novo com imagem menor ou outro modelo." };
      }
      if (message.includes("REPLICATE_API_TOKEN") || message.includes("Defina REPLICATE")) {
        return { ok: false, error: "Token da Replicate ausente ou inválido." };
      }
      if (/404|not found|could not be found/i.test(message) && /models\//i.test(message)) {
        return {
          ok: false,
          error:
            "Modelo de visão não encontrado na Replicate (404). Confira REPLICATE_VISION_MODEL ou digest em …/versions.",
        };
      }
      if (/422|invalid version|not permitted/i.test(message)) {
        return {
          ok: false,
          error:
            "Versão do modelo inválida na Replicate (422). Use slug `dono/nome` ou digest de 64 caracteres.",
        };
      }
      return { ok: false, error: message };
    }

    const data = mapChecklistToPlantaAnaliseIA(checklist);

    const userIdRaw = formData.get(USER_ID_FIELD);
    const userId =
      typeof userIdRaw === "string" && UUID_RE.test(userIdRaw.trim()) ? userIdRaw.trim() : null;

    const nomeProjetoRaw = formData.get(NOME_PROJETO_FIELD);
    const nomeRaw = formData.get(NOME_FIELD);
    const nomeProjeto =
      (typeof nomeProjetoRaw === "string" && nomeProjetoRaw.trim()
        ? nomeProjetoRaw.trim()
        : typeof nomeRaw === "string" && nomeRaw.trim()
          ? nomeRaw.trim()
          : "Análise Gabarito");

    let persistError: string | undefined;
    let projeto_id: string | undefined;
    let area_terreno_m2: number | undefined;
    let area_restante_potencial_m2: number | null | undefined;

    try {
      const supabase = getSupabaseAdmin();
      const buffer = Buffer.from(base64, "base64");
      const saved = await insertProjetoAnaliseSnapshot(supabase, metricasPrecomputadas, {
        nome: nomeProjeto,
        zonaUrbanistica: zona,
        areaTerrenoM2: areaTerrenoM2,
        checklist,
        rawOutput,
        visionRaw,
        auditRaw,
        imageBuffer: buffer,
        mimeType: mime,
        userId,
      });
      projeto_id = saved.id;
      area_terreno_m2 = areaTerrenoM2;
      area_restante_potencial_m2 = saved.area_restante_potencial_m2;
      checklist = saved.checklistPersist;
    } catch (persistErr) {
      persistError =
        persistErr instanceof Error ? persistErr.message : "Falha ao gravar no Supabase.";
    }

    const ultima_analise_ia = composeUltimaAnaliseIa(checklist, auditRaw, visionRaw) || rawOutput;

    return {
      ok: true,
      data,
      raw: rawOutput,
      checklist,
      ultima_analise_ia,
      persistError,
      projeto_id,
      area_terreno_m2,
      area_restante_potencial_m2,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro inesperado na análise.";
    if (message.includes("NEXT_PUBLIC_SUPABASE_URL") || message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: false, error: "Supabase admin não configurado." };
    }
    return { ok: false, error: message };
  }
}
