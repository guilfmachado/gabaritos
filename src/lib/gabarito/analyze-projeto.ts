import { resolvePublicImageUrlForServer } from "@/lib/env/resolve-public-image-url";
import { computeAreaRestantePotencialM2, computeMetricasTerreno } from "@/lib/gabarito/metricas-terreno";
import { coerceNormaLocal } from "@/lib/gabarito/norma-coerce";
import { composeUltimaAnaliseIa } from "@/lib/gabarito/persist-analise-projeto";
import { analyzePlantaVision } from "@/lib/replicate/analyze-planta";
import { createServiceSupabase } from "@/lib/supabase/service";
import { NORMAS_LOCAIS_COLUMNS, type NormaLocal, type StatusChecklist } from "@/types/gabarito";

export type AnalyzeProjetoSuccess = {
  ok: true;
  projeto_id: string;
  checklist: StatusChecklist;
  resultado_ia: string;
  ultima_analise_ia: string;
  norma: NormaLocal;
  imagem_utilizada: string;
  area_terreno_m2: number | null;
  area_restante_potencial_m2: number | null;
};

export type AnalyzeProjetoFailure = {
  ok: false;
  error: string;
  status: number;
};

export type AnalyzeProjetoResult = AnalyzeProjetoSuccess | AnalyzeProjetoFailure;

function mimeFromContentType(header: string | null, url: string): string {
  const h = header?.split(";")[0]?.trim().toLowerCase();
  if (h === "image/png" || h === "image/jpeg" || h === "image/jpg" || h === "image/webp") {
    return h === "image/jpg" ? "image/jpeg" : h;
  }
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Não foi possível baixar a planta (HTTP ${res.status}).`);
  }
  const mimeType = mimeFromContentType(res.headers.get("content-type"), imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Imagem da planta vazia.");
  return { base64: buf.toString("base64"), mimeType };
}

export async function analyzeProjetoById(projetoId: string): Promise<AnalyzeProjetoResult> {
  const id = projetoId?.trim();
  if (!id) {
    return { ok: false, error: "projeto_id inválido.", status: 400 };
  }

  try {
    const supabase = createServiceSupabase();
    const { data: projeto, error: pErr } = await supabase
      .from("projetos")
      .select(
        "id, zona_urbanistica, planta_url, imagem_planta_url, inscricao_imobiliaria, nome, area_terreno_m2",
      )
      .eq("id", id)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!projeto) {
      return { ok: false, error: "Projeto não encontrado.", status: 404 };
    }

    const imageUrlRaw =
      (projeto as { imagem_planta_url?: string | null; planta_url?: string | null }).imagem_planta_url?.trim() ||
      (projeto as { planta_url?: string | null }).planta_url?.trim() ||
      "";

    if (!imageUrlRaw) {
      return {
        ok: false,
        error:
          "Defina imagem_planta_url ou planta_url (URL pública da planta) antes de rodar a análise.",
        status: 422,
      };
    }

    const imageUrl = resolvePublicImageUrlForServer(imageUrlRaw);

    const areaTerrenoRaw = (projeto as { area_terreno_m2?: number | null }).area_terreno_m2;
    const areaTerrenoM2 =
      areaTerrenoRaw != null && Number.isFinite(Number(areaTerrenoRaw)) && Number(areaTerrenoRaw) > 0
        ? Number(areaTerrenoRaw)
        : null;

    if (areaTerrenoM2 == null) {
      return {
        ok: false,
        error:
          "Defina area_terreno_m2 no cadastro do projeto antes da análise (obrigatório para auditoria da legislação municipal).",
        status: 422,
      };
    }

    const { data: normaRow, error: nErr } = await supabase
      .from("normas_locais")
      .select(NORMAS_LOCAIS_COLUMNS)
      .eq("zona_urbanistica", projeto.zona_urbanistica)
      .maybeSingle();

    if (nErr) throw nErr;
    if (!normaRow) {
      return { ok: false, error: "Norma da zona não encontrada em normas_locais.", status: 404 };
    }

    const norma = coerceNormaLocal(normaRow as Record<string, unknown>);
    const metricasPrecomputadas = computeMetricasTerreno(areaTerrenoM2, norma);

    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

    const { rawOutput, checklist, visionRaw, auditRaw } = await analyzePlantaVision({
      imageBase64: base64,
      mimeType,
      zona: projeto.zona_urbanistica,
      norma,
      areaTerrenoM2: areaTerrenoM2,
      metricasPrecomputadas,
    });

    const ultimaAnaliseIa = composeUltimaAnaliseIa(checklist, auditRaw, visionRaw) || rawOutput;
    const areaRestante = computeAreaRestantePotencialM2(
      metricasPrecomputadas,
      checklist.area_construida_estimada_ia_m2,
    );

    const { error: uErr } = await supabase
      .from("projetos")
      .update({
        resultado_ia: rawOutput,
        status_checklist: checklist as unknown as Record<string, unknown>,
        ultima_analise_ia: ultimaAnaliseIa,
        area_restante_potencial_m2: areaRestante,
        area_terreno_m2: areaTerrenoM2,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (uErr) throw uErr;

    return {
      ok: true,
      projeto_id: id,
      checklist,
      resultado_ia: rawOutput,
      ultima_analise_ia: ultimaAnaliseIa,
      norma,
      imagem_utilizada: imageUrl,
      area_terreno_m2: areaTerrenoM2,
      area_restante_potencial_m2: areaRestante,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na análise.";
    const status = message.includes("Defina REPLICATE") ? 503 : 500;
    return { ok: false, error: message, status };
  }
}
