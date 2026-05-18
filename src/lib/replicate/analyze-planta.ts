import { throwMissingEnv } from "@/lib/env/missing-env-log";
import { computeMetricasTerreno, type MetricasTerrenoPrecomputadas } from "@/lib/gabarito/metricas-terreno";
import { enrichChecklistWithUrbanIntelligence } from "@/lib/gabarito/enrich-checklist";
import { resolveVisionModelRunRef } from "@/lib/replicate/resolve-vision-model-run-ref";
import Replicate from "replicate";
import { buildLegalAuditPrompt } from "@/lib/replicate/build-legal-audit-prompt";
import { buildVisionExtractionPrompt } from "@/lib/replicate/build-vision-extract-prompt";
import { parseVisionExtraction } from "@/lib/replicate/parse-vision-extraction";
import { runLlamaAuditPrompt } from "@/lib/replicate/run-llama-text";
import { parseChecklistFromModelOutput } from "@/lib/replicate/parse-checklist";
import type { ExtracaoVisaoLlama, NormaLocal, StatusChecklist } from "@/types/gabarito";

/** Padrão estável na Replicate para visão: LLaVA 13B (image URL + prompt). */
const DEFAULT_VISION_MODEL = "yorickvp/llava-13b";

export type AnalyzePlantaInput = {
  imageBase64: string;
  mimeType: string;
  zona: string;
  norma: NormaLocal;
  areaTerrenoM2?: number | null;
  metricasPrecomputadas?: MetricasTerrenoPrecomputadas | null;
  areaConstruidaProjetoM2?: number | null;
  areaPermeavelPropostaM2?: number | null;
  usoImovel?: string | null;
};

export type AnalyzePlantaResult = {
  rawOutput: string;
  checklist: StatusChecklist;
  visionRaw: string;
  auditRaw: string;
};

export type AuditFromExtracaoInput = {
  zona: string;
  norma: NormaLocal;
  extracao: ExtracaoVisaoLlama;
  areaTerrenoM2: number;
  metricasPrecomputadas?: MetricasTerrenoPrecomputadas | null;
  areaConstruidaProjetoM2?: number | null;
  areaPermeavelPropostaM2?: number | null;
  usoImovel?: string | null;
};

/** Auditoria 70B a partir de extração já obtida (sem nova chamada de visão). */
export async function auditPlantaFromExtracao(
  input: AuditFromExtracaoInput,
): Promise<{ checklist: StatusChecklist; auditRaw: string }> {
  const metricas =
    input.metricasPrecomputadas ?? computeMetricasTerreno(input.areaTerrenoM2, input.norma);
  const auditPrompt = buildLegalAuditPrompt({
    zona: input.zona,
    norma: input.norma,
    extracao: input.extracao,
    areaTerrenoM2: input.areaTerrenoM2,
    metricas,
    areaConstruidaProjetoM2: input.areaConstruidaProjetoM2 ?? null,
    areaPermeavelPropostaM2: input.areaPermeavelPropostaM2 ?? null,
    usoImovelDeclarado: input.usoImovel ?? null,
  });
  const auditRaw = await runLlamaAuditPrompt(auditPrompt, 4096);
  let checklist = parseChecklistFromModelOutput(auditRaw);
  checklist = { ...checklist, extracao_visao: input.extracao };
  const userAc = input.areaConstruidaProjetoM2;
  if (userAc != null && Number.isFinite(userAc) && userAc > 0) {
    checklist.area_construida_estimada_ia_m2 = userAc;
  } else {
    const areaBuiltVision =
      input.extracao.area_construida_total_m2 ?? input.extracao.area_construida_estimada_m2;
    if (
      areaBuiltVision != null &&
      Number.isFinite(areaBuiltVision) &&
      (checklist.area_construida_estimada_ia_m2 == null || !Number.isFinite(checklist.area_construida_estimada_ia_m2))
    ) {
      checklist.area_construida_estimada_ia_m2 = areaBuiltVision;
    }
  }
  if (input.usoImovel && /residencial/i.test(input.usoImovel)) {
    checklist.inferencia_uso_residencial = true;
  }
  checklist = enrichChecklistWithUrbanIntelligence(checklist, input.norma, input.areaTerrenoM2);
  return { checklist, auditRaw };
}

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throwMissingEnv(
      "REPLICATE_API_TOKEN",
      "Análise por visão usa a API da Replicate; token apenas no servidor.",
    );
  }
  return new Replicate({ auth: token });
}

function stringifyModelOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map(String).join("");
  return JSON.stringify(output);
}

function buildVisionModelInput(modelRef: string, imageUrl: string, prompt: string): Record<string, unknown> {
  const r = modelRef.toLowerCase();
  if (r.includes("llava")) {
    return { image: imageUrl, prompt };
  }
  if (r.includes("moondream")) {
    return { image: imageUrl, prompt };
  }
  if (
    (r.includes("llama-3.2") && r.includes("vision")) ||
    r.includes("ollama-llama3.2-vision") ||
    r.includes("meta-llama-3.2-11b-vision")
  ) {
    return { image: imageUrl, prompt, max_tokens: 4096 };
  }
  return { image: imageUrl, prompt, max_tokens: 4096 };
}

function fallbackExtracao(): ExtracaoVisaoLlama {
  return {
    area_construida_total_m2: null,
    area_projecao_horizontal_m2: null,
    area_construida_estimada_m2: null,
    taxa_ocupacao_estimada_pct: null,
    recuo_frontal_m: null,
    recuo_lateral_m: null,
    recuo_fundos_m: null,
    altura_edificacao_estimada_m: null,
    area_permeavel_estimada_m2: null,
    uso_predominante_planta: "Indeterminado",
    observacoes_extracao:
      "Extração estruturada indisponível; a auditoria 70B deve usar o texto bruto da visão e os dados declarados.",
  };
}

export async function analyzePlantaVision(payload: AnalyzePlantaInput): Promise<AnalyzePlantaResult> {
  const replicate = getReplicate();
  const modelRef = process.env.REPLICATE_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
  const model = await resolveVisionModelRunRef(replicate, modelRef);
  const buffer = Buffer.from(payload.imageBase64, "base64");
  /** URL pública na CDN da Replicate — não usar file:// nem localhost; a API da Replicate exige URL acessível. */
  const file = await replicate.files.create(buffer, {
    content_type: payload.mimeType || "image/png",
    filename: "planta",
  });

  const imageUrl = file.urls.get;
  if (typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) {
    console.error(
      "[analyzePlantaVision] Replicate files.create não devolveu URL https pública da imagem:",
      typeof imageUrl,
    );
    throw new Error(
      "A visão na Replicate exige uma URL pública http(s) da imagem (não file:// nem caminho local). Verifique o token e o retorno de files.create.",
    );
  }
  const visionPrompt = buildVisionExtractionPrompt(payload.zona, payload.norma);
  const visionInput = buildVisionModelInput(modelRef, imageUrl, visionPrompt);

  const visionOutput = await replicate.run(model, { input: visionInput });
  const visionRaw = stringifyModelOutput(visionOutput);

  let extracao = parseVisionExtraction(visionRaw);
  if (!extracao) {
    extracao = fallbackExtracao();
  }

  const areaTerreno =
    payload.metricasPrecomputadas?.area_terreno_m2 ??
    (payload.areaTerrenoM2 != null && payload.areaTerrenoM2 > 0 ? payload.areaTerrenoM2 : null);
  if (areaTerreno == null || !Number.isFinite(areaTerreno)) {
    throw new Error("Área do terreno é obrigatória para a auditoria jurídica (70B).");
  }

  const metricas =
    payload.metricasPrecomputadas ?? computeMetricasTerreno(areaTerreno, payload.norma);
  const { checklist, auditRaw } = await auditPlantaFromExtracao({
    zona: payload.zona,
    norma: payload.norma,
    extracao,
    areaTerrenoM2: areaTerreno,
    metricasPrecomputadas: metricas,
    areaConstruidaProjetoM2: payload.areaConstruidaProjetoM2 ?? null,
    areaPermeavelPropostaM2: payload.areaPermeavelPropostaM2 ?? null,
    usoImovel: payload.usoImovel ?? null,
  });

  const rawOutput = JSON.stringify(
    {
      modelo_visao: modelRef,
      extracao_visao_bruta: visionRaw,
      auditoria_70b_bruta: auditRaw,
    },
    null,
    2,
  );

  return { rawOutput, checklist, visionRaw, auditRaw };
}
