import type { AlertaCriticoUrbano, ChecklistStatus, NormaLocal, PotencialArt1320, StatusChecklist } from "@/types/gabarito";

/**
 * Limite de área construída indicativo: terreno × coeficiente de aproveitamento máximo
 * (`indice_aproveitamento_max` na base), alinhado ao uso do CA no Anexo IV / LC 751.
 */
export function computePotencialArt1320(
  areaTerrenoM2: number,
  norma: NormaLocal,
  areaConstruidaEstimadaIaM2: number | null,
): PotencialArt1320 {
  const ca = norma.indice_aproveitamento_max;
  // Estrito: Área Máxima Permitida = area_terreno_m2 * indice_aproveitamento_max
  const limite = areaTerrenoM2 * ca;
  const ac = areaConstruidaEstimadaIaM2;

  let status: ChecklistStatus = "revisar";
  let nota_tecnica =
    "Estimativa automática com base na área de terreno declarada e no CA da zona; confira memorial e Anexo IV vigente.";

  if (ac == null || Number.isNaN(ac)) {
    nota_tecnica =
      "A IA não devolveu área construída estimada (m²). Indique cotas na prancha ou refine o prompt para comparar com o limite.";
  } else if (ac > limite * 1.03) {
    status = "inconforme";
    nota_tecnica = `Limite indicativo ~${limite.toFixed(1)} m² (terreno × CA ${ca}). A estimativa da IA (${ac.toFixed(1)} m²) ultrapassa esse teto.`;
  } else {
    status = "conforme";
    nota_tecnica = `Estimativa da IA ${ac.toFixed(1)} m² frente ao limite indicativo ~${limite.toFixed(1)} m² (CA ${ca}).`;
  }

  const utilizacao_coeficiente_pct =
    ac != null && limite > 0 ? Math.min(999, (ac / limite) * 100) : null;

  if (ac != null && limite > 0 && ac < limite * 0.8) {
    nota_tecnica =
      `${nota_tecnica} ` +
      `Sugestão: Aproveitamento de Potencial Construtivo — a estimativa (${ac.toFixed(1)} m²) está abaixo de 80% do potencial (~${limite.toFixed(1)} m²).`;
  }

  return {
    area_terreno_m2: areaTerrenoM2,
    coeficiente_aproveitamento_max: ca,
    limite_area_construida_m2: limite,
    area_construida_estimada_ia_m2: ac,
    utilizacao_coeficiente_pct,
    status,
    nota_tecnica,
  };
}

export function buildSugestaoAproveitamentoPotencial(p: PotencialArt1320): string | null {
  if (p.area_construida_estimada_ia_m2 == null || !Number.isFinite(p.area_construida_estimada_ia_m2)) return null;
  if (!Number.isFinite(p.limite_area_construida_m2) || p.limite_area_construida_m2 <= 0) return null;
  if (p.area_construida_estimada_ia_m2 >= p.limite_area_construida_m2 * 0.8) return null;
  return (
    `Aproveitamento de Potencial Construtivo: a área construída estimada (${p.area_construida_estimada_ia_m2.toFixed(1)} m²) ` +
    `usa menos de 80% do potencial indicativo pelo CA (~${p.limite_area_construida_m2.toFixed(1)} m²). ` +
    "Há margem de estudo para ampliar área construída, respeitando recuos mínimos, TO máximo e permeabilidade."
  );
}

function zonaIndicaRestricaoArt41(zona: string | null | undefined): boolean {
  const z = (zona ?? "").toUpperCase();
  return z.includes("APR") || z.includes("COTA 12") || z.includes("COTA12") || z.includes("12M");
}

/** Alerta crítico (Art. 41): uso residencial em APR e/ou cota 12m → bloqueio de ocupação (pré-análise). */
export function buildAlertaBloqueioOcupacaoArt41(
  checklist: StatusChecklist,
  zonaUrbanistica?: string | null,
): AlertaCriticoUrbano | null {
  const res = checklist.inferencia_uso_residencial === true;
  const apr = checklist.inferencia_area_potencial_risco === true;
  const enc = checklist.inferencia_cota_enchente_12m === true;
  const zonaRestrita = zonaIndicaRestricaoArt41(zonaUrbanistica);

  if (!res) return null;
  if (!(apr || enc || zonaRestrita)) return null;

  return {
    codigo: "BLOQUEIO_OCUPACAO",
    severidade: "critico",
    titulo: "BLOQUEIO DE OCUPAÇÃO (Art. 41, I)",
    mensagem:
      "Proibido uso residencial abaixo da cota 12m em áreas com risco de cheias (ARCO/APR), conforme Art. 41, I da LC 751/2010. " +
      "§ 1º: admitem-se edificações sobre pilotis (sem fechamento), áreas de recreação e subsolo para estacionamento, desde que não interfiram no fluxo das águas.",
  };
}
