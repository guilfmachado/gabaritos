import type {
  AlertaCriticoUrbano,
  CalculoContrapartidaUsoSolo,
  RestricaoUsoSoloStatus,
  StatusChecklist,
} from "@/types/gabarito";

export const DECRETO_9143_2010 = {
  id: "decreto-9143-2010",
  titulo: "Decreto nº 9143/2010",
  status: "revogado",
  revogadoPor: "Decreto nº 9518/2011",
  formulaRevogada: "CF = ACD * VR",
  mensagem:
    "Atenção: Este parâmetro baseia-se no Decreto 9143/2010, que foi revogado. Verifique o Decreto nº 9518/2011.",
} as const;

export const DECRETO_9151_2010 = {
  id: "decreto-9151-2010",
  titulo: "Decreto nº 9151/2010",
  status: "revogado",
  revogadoPor: "Decreto nº 9853/2012",
  escopoHistorico: "Áreas com restrição de uso e ocupação do solo: ARCO, AIA, ANEA, APP e Unidades de Conservação.",
  mensagem:
    "Atenção: O Decreto 9151/2010 foi revogado pelo Decreto nº 9853/2012. Use-o apenas como referência histórica e confirme a restrição vigente no cadastro municipal.",
} as const;

export type CalculoContrapartidaUsoSoloRevogado = CalculoContrapartidaUsoSolo & {
  norma_id: typeof DECRETO_9143_2010.id;
  status: typeof DECRETO_9143_2010.status;
  substituido_por: typeof DECRETO_9143_2010.revogadoPor;
};

export function buildCalculoAlteracaoUsoSoloRevogado9143(
  acdM2: number,
  vr: CalculoContrapartidaUsoSolo["vr"],
): CalculoContrapartidaUsoSoloRevogado {
  return {
    norma_id: DECRETO_9143_2010.id,
    status: DECRETO_9143_2010.status,
    formula: DECRETO_9143_2010.formulaRevogada,
    acd_m2: acdM2,
    vr,
    substituido_por: DECRETO_9143_2010.revogadoPor,
  };
}

export const ALERTA_DECRETO_9143_REVOGADO: AlertaCriticoUrbano = {
  codigo: "NORMA_REVOGADA_DECRETO_9143_2010",
  severidade: "alerta",
  titulo: "Parâmetro Revogado",
  mensagem: DECRETO_9143_2010.mensagem,
};

export const ALERTA_DECRETO_9151_REVOGADO: AlertaCriticoUrbano = {
  codigo: "NORMA_REVOGADA_DECRETO_9151_2010",
  severidade: "alerta",
  titulo: "Decreto de Restrições Revogado",
  mensagem: DECRETO_9151_2010.mensagem,
};

export const ALERTA_EGGA_RESTRICAO_GEOTECNICA: AlertaCriticoUrbano = {
  codigo: "EGGA_RESTRICAO_GEOTECNICA",
  severidade: "critico",
  titulo: "EGGA Obrigatório",
  mensagem:
    "Imóvel marcado como Em Estudo ou Interditado em área de risco/restrição. Anexe Estudo Geológico-Geotécnico e Ambiental (EGGA) assinado por profissional habilitado com registro no CREA e submeta à análise do órgão municipal competente.",
};

const FORMULA_CF_ACD_VR_RE = /\bCF\b\s*=\s*\bACD\b\s*(?:\*|×|x)\s*\bVR\b/i;
const DECRETO_9143_RE = /decreto\s*(?:n[ºo]\.?\s*)?9143(?:\/2010)?/i;
const DECRETO_9151_RE = /decreto\s*(?:n[ºo]\.?\s*)?9151(?:\/2010)?/i;

export function referencesDeprecatedDecreto9143Formula(value: unknown): boolean {
  if (typeof value === "string") {
    return FORMULA_CF_ACD_VR_RE.test(value) || (DECRETO_9143_RE.test(value) && /\bVR\b|\bACD\b/i.test(value));
  }

  if (Array.isArray(value)) {
    return value.some((item) => referencesDeprecatedDecreto9143Formula(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => referencesDeprecatedDecreto9143Formula(item));
  }

  return false;
}

export function referencesDeprecatedDecreto9151(value: unknown): boolean {
  if (typeof value === "string") {
    return DECRETO_9151_RE.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => referencesDeprecatedDecreto9151(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => referencesDeprecatedDecreto9151(item));
  }

  return false;
}

export function normalizeRestricaoUsoSoloStatus(value: unknown): RestricaoUsoSoloStatus {
  if (typeof value !== "string") {
    return "nao_informado";
  }

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "sem_restricao" || normalized === "sem_restricoes") return "sem_restricao";
  if (normalized === "liberada_com_restricao" || normalized === "liberado_com_restricao") {
    return "liberada_com_restricao";
  }
  if (normalized === "em_estudo") return "em_estudo";
  if (normalized === "interditado" || normalized === "interditada") return "interditado";
  return "nao_informado";
}

function appendAlert(checklist: StatusChecklist, alerta: AlertaCriticoUrbano): StatusChecklist {
  const alertas = checklist.alertas_criticos ?? [];
  if (alertas.some((item) => item.codigo === alerta.codigo)) {
    return checklist;
  }

  return {
    ...checklist,
    alertas_criticos: [alerta, ...alertas],
  };
}

export function appendDeprecatedNormaAlerts(checklist: StatusChecklist, sources: unknown[]): StatusChecklist {
  let next = checklist;
  if (sources.some((source) => referencesDeprecatedDecreto9143Formula(source))) {
    next = appendAlert(next, ALERTA_DECRETO_9143_REVOGADO);
  }
  if (sources.some((source) => referencesDeprecatedDecreto9151(source))) {
    next = appendAlert(next, ALERTA_DECRETO_9151_REVOGADO);
  }

  return next;
}

export function appendRestricaoGeotecnicaAlerts(
  checklist: StatusChecklist,
  restricaoUsoSolo: unknown,
): StatusChecklist {
  const status = normalizeRestricaoUsoSoloStatus(restricaoUsoSolo);
  if (status !== "em_estudo" && status !== "interditado") {
    return checklist;
  }

  return appendAlert(checklist, ALERTA_EGGA_RESTRICAO_GEOTECNICA);
}
