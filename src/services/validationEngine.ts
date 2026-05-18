import {
  validarRebaixosAcessoVeicularLc748,
  validarViaLoteamentoLc748,
} from "@/lib/gabarito/circulacao-lc748";
import {
  ALERTA_IMOVEL_TOMBADO_LC1247,
  validarCompartimentosLc1247,
  validarEscadasLc1247,
} from "@/lib/gabarito/edificacoes-lc1247";
import { validarParametrosZoneamentoLc751 } from "@/lib/gabarito/zoneamento-lc751";
import type {
  ChecklistItem,
  CompartimentoLc1247,
  EscadaLc1247,
  GabaritoEngineSeverity,
  GabaritoEngineViolation,
  NormaLocal,
  RebaixoAcessoVeicularLc748,
  ViaLoteamentoLc748Input,
} from "@/types/gabarito";

export type ValidationSeverity = GabaritoEngineSeverity;
export type ValidationPillar = "AMBIENTAL_RISCO" | "ZONEAMENTO" | "CIRCULACAO" | "EDIFICACOES" | "LOTEAMENTO_ZEIS";

export type ProjectViolation = GabaritoEngineViolation & {
  pillar: ValidationPillar;
};

export type GabaritoEngineResult = {
  isAprovado: boolean;
  violations: ProjectViolation[];
};

export type CorpoDaguaData = {
  distancia_m: number;
  largura_curso_m?: number | null;
  app_urbana_consolidada_m?: 15 | 20 | 33 | null;
  app_exigida_m?: number | null;
};

export type ProjectData = {
  norma?: NormaLocal | null;
  zona_urbanistica?: string | null;
  uso_imovel?: string | null;
  tipo_projeto?: "edificacao" | "loteamento" | "regularizacao" | "outro";
  is_loteamento_residencial?: boolean;
  is_tombado?: boolean;

  area_terreno_m2: number;
  area_construida_total_m2?: number | null;
  area_projecao_horizontal_m2?: number | null;
  area_permeavel_m2?: number | null;
  recuo_frontal_m?: number | null;
  afastamento_lateral_m?: number | null;
  parede_lindeira_tem_aberturas?: boolean | null;
  altura_edificacao_m?: number | null;

  cota_terreno_m?: number | null;
  movimentacao_terra_aterro?: boolean | null;
  corpos_dagua?: CorpoDaguaData[];

  testada_m?: number | null;
  rebaixos?: RebaixoAcessoVeicularLc748[];
  distancias_entre_rebaixos_m?: number[];
  uso_especial_rebaixo?: "posto_combustivel" | "logistica_5_ou_mais_caminhoes" | "outro";
  nao_residencial_rua_sem_estacionamento?: boolean;

  vias_loteamento?: ViaLoteamentoLc748Input[];
  area_gleba_m2?: number | null;
  area_publica_m2?: number | null;

  compartimentos?: CompartimentoLc1247[];
  escadas?: EscadaLc1247[];
};

function isResidential(value: string | null | undefined): boolean {
  return /residencial/i.test(value ?? "");
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fromChecklistItem(
  item: ChecklistItem,
  pillar: ProjectViolation["pillar"],
  law: string,
  article: string,
  severity: ValidationSeverity = "CRITICAL",
): ProjectViolation {
  return {
    id: item.id,
    severity,
    pillar,
    title: item.rotulo,
    message: item.detalhe ?? item.rotulo,
    law,
    article,
  };
}

function appExigida(corpo: CorpoDaguaData): number {
  if (finite(corpo.app_exigida_m) && corpo.app_exigida_m > 0) return corpo.app_exigida_m;
  if (corpo.app_urbana_consolidada_m) return corpo.app_urbana_consolidada_m;
  const largura = corpo.largura_curso_m;
  if (!finite(largura)) return 30;
  if (largura <= 10) return 30;
  if (largura <= 50) return 50;
  if (largura <= 200) return 100;
  if (largura <= 600) return 200;
  return 500;
}

function validateAmbientalRisco(project: ProjectData): ProjectViolation[] {
  const violations: ProjectViolation[] = [];
  const cota = project.cota_terreno_m;
  const loteamentoResidencial = project.is_loteamento_residencial === true || (project.tipo_projeto === "loteamento" && isResidential(project.uso_imovel));

  if (finite(cota) && cota < 12 && loteamentoResidencial) {
    violations.push({
      id: "lc749_cota_loteamento_residencial",
      severity: "CRITICAL",
      pillar: "AMBIENTAL_RISCO",
      title: "Loteamento residencial em cota inferior a 12 m",
      message: "Terreno em cota inferior a 12 m não deve receber loteamento residencial sem validação ambiental/urbanística específica.",
      law: "LC 749/2010",
      article: "Art. 8º",
      measured: cota,
      limit: ">= 12 m",
    });
  }

  if (finite(cota) && cota < 10 && project.movimentacao_terra_aterro === true) {
    violations.push({
      id: "lc747_cota_aterro_movimentacao",
      severity: "CRITICAL",
      pillar: "AMBIENTAL_RISCO",
      title: "Movimentação de terra/aterro em cota inferior a 10 m",
      message: "Movimentação de terra ou aterro em cota inferior a 10 m exige bloqueio/validação ambiental estrita.",
      law: "LC 747/2010",
      article: "Art. 92",
      measured: cota,
      limit: ">= 10 m",
    });
  }

  project.corpos_dagua?.forEach((corpo, idx) => {
    if (!finite(corpo.distancia_m)) return;
    const limite = appExigida(corpo);
    if (corpo.distancia_m < limite) {
      violations.push({
        id: `app_corpo_dagua_${idx + 1}`,
        severity: "CRITICAL",
        pillar: "AMBIENTAL_RISCO",
        title: "Interferência em APP de corpo d'água",
        message: `Distância ao corpo d'água (${corpo.distancia_m.toFixed(2)} m) inferior à faixa mínima aplicável (${limite.toFixed(2)} m).`,
        law: "LC 747/2010 / Código Florestal",
        article: "APP hídrica",
        measured: corpo.distancia_m,
        limit: limite,
      });
    }
  });

  return violations;
}

function validateZoneamento(project: ProjectData): ProjectViolation[] {
  const violations: ProjectViolation[] = [];
  const norma = project.norma;
  const areaTerreno = project.area_terreno_m2;
  if (!norma || !finite(areaTerreno) || areaTerreno <= 0) return violations;

  const caBasico = finite(norma.coeficiente_aproveitamento_basico)
    ? norma.coeficiente_aproveitamento_basico
    : norma.indice_aproveitamento_max;
  const caMax = finite(norma.coeficiente_aproveitamento_maximo)
    ? norma.coeficiente_aproveitamento_maximo
    : norma.indice_aproveitamento_max;
  const areaConstruida = project.area_construida_total_m2;

  if (finite(areaConstruida)) {
    const caProjeto = areaConstruida / areaTerreno;
    if (caProjeto > caMax) {
      violations.push({
        id: "lc751_ca_acima_maximo",
        severity: "CRITICAL",
        pillar: "ZONEAMENTO",
        title: "Coeficiente de Aproveitamento acima do máximo",
        message: `CA do projeto ${caProjeto.toFixed(2)} excede o CA máximo da zona ${norma.zona_urbanistica} (${caMax.toFixed(2)}).`,
        law: "LC 751/2010",
        article: "Art. 20",
        measured: caProjeto,
        limit: caMax,
      });
    } else if (caProjeto > caBasico) {
      violations.push({
        id: "lc1181_outorga_onerosa",
        severity: "INFO",
        pillar: "ZONEAMENTO",
        title: "Exige Outorga Onerosa",
        message: "Área construída ultrapassa o CA básico e fica condicionada à Outorga Onerosa do Direito de Construir.",
        law: "LC 1181/2018",
        article: "Arts. 80 a 83",
        measured: caProjeto,
        limit: caBasico,
      });
    }
  }

  violations.push(
    ...validarParametrosZoneamentoLc751(norma, {
      area_terreno_m2: areaTerreno,
      area_projecao_horizontal_m2: project.area_projecao_horizontal_m2,
      area_permeavel_m2: project.area_permeavel_m2,
      recuo_frontal_m: project.recuo_frontal_m,
      afastamento_lateral_m: project.afastamento_lateral_m,
      parede_lindeira_tem_aberturas: project.parede_lindeira_tem_aberturas,
    }).map((item) => fromChecklistItem(item, "ZONEAMENTO", "LC 751/2010", inferLc751Article(item.id))),
  );

  if (finite(project.altura_edificacao_m) && finite(project.afastamento_lateral_m)) {
    const afastamentoMin = project.altura_edificacao_m / 6;
    if (project.afastamento_lateral_m > 0 && project.afastamento_lateral_m < afastamentoMin) {
      violations.push({
        id: "lc751_afastamento_h_sobre_6",
        severity: "CRITICAL",
        pillar: "ZONEAMENTO",
        title: "Afastamento lateral inferior a H/6",
        message: `Altura H=${project.altura_edificacao_m.toFixed(2)} m exige afastamento lateral indicativo de ${afastamentoMin.toFixed(2)} m.`,
        law: "LC 751/2010",
        article: "Art. 35",
        measured: project.afastamento_lateral_m,
        limit: afastamentoMin,
      });
    }
  }

  return violations;
}

function inferLc751Article(id: string): string {
  if (id.includes("taxa_ocupacao")) return "Art. 21";
  if (id.includes("permeabilidade")) return "Art. 22";
  if (id.includes("recuo_frontal")) return "Art. 31";
  if (id.includes("abertura_divisa")) return "Art. 35";
  return "LC 751/2010";
}

function validateCirculacao(project: ProjectData): ProjectViolation[] {
  const violations: ProjectViolation[] = [];

  if (finite(project.testada_m) && project.rebaixos?.length) {
    violations.push(
      ...validarRebaixosAcessoVeicularLc748({
        testada_m: project.testada_m,
        rebaixos: project.rebaixos,
        distancias_entre_rebaixos_m: project.distancias_entre_rebaixos_m,
        uso_especial: project.uso_especial_rebaixo,
        nao_residencial_rua_sem_estacionamento: project.nao_residencial_rua_sem_estacionamento,
      }).map((item) => fromChecklistItem(item, "CIRCULACAO", "LC 748/2010", item.id.includes("total") ? "Art. 11" : "Art. 13")),
    );
  }

  project.vias_loteamento?.forEach((via, idx) => {
    violations.push(
      ...validarViaLoteamentoLc748(via).map((item) => ({
        ...fromChecklistItem(item, "CIRCULACAO", "LC 748/2010", item.id.includes("sem_saida") ? "Arts. 21 e 28" : "Art. 24"),
        id: `${item.id}_${idx + 1}`,
      })),
    );
  });

  return violations;
}

function validateEdificacoes(project: ProjectData): ProjectViolation[] {
  if (project.is_tombado === true) {
    return [{
      id: ALERTA_IMOVEL_TOMBADO_LC1247.codigo,
      severity: "WARNING",
      pillar: "EDIFICACOES",
      title: ALERTA_IMOVEL_TOMBADO_LC1247.titulo,
      message: ALERTA_IMOVEL_TOMBADO_LC1247.mensagem,
      law: "LC 1247/2019",
      article: "Art. 68",
    }];
  }

  return [
    ...validarCompartimentosLc1247(project.compartimentos ?? []).map((item) => fromChecklistItem(item, "EDIFICACOES", "LC 1247/2019", inferLc1247Article(item.id))),
    ...validarEscadasLc1247(project.escadas ?? []).map((item) => fromChecklistItem(item, "EDIFICACOES", "LC 1247/2019", "Capítulo IV")),
  ];
}

function inferLc1247Article(id: string): string {
  if (id.includes("pe_direito")) return "Capítulo III";
  if (id.includes("iluminacao") || id.includes("ventilacao")) return "Capítulo III";
  return "LC 1247/2019";
}

function validateLoteamentoZeis(project: ProjectData): ProjectViolation[] {
  const violations: ProjectViolation[] = [];
  const isLoteamento = project.tipo_projeto === "loteamento" || project.is_loteamento_residencial === true;

  if (isLoteamento && finite(project.area_gleba_m2) && finite(project.area_publica_m2) && project.area_gleba_m2 > 0) {
    const pctPublica = project.area_publica_m2 / project.area_gleba_m2;
    if (pctPublica < 0.35) {
      violations.push({
        id: "lc749_area_publica_minima",
        severity: "CRITICAL",
        pillar: "LOTEAMENTO_ZEIS",
        title: "Área pública inferior a 35% da gleba",
        message: `Áreas públicas somam ${(pctPublica * 100).toFixed(1)}% da gleba; mínimo exigido 35%.`,
        law: "LC 749/2010",
        article: "Diretrizes de parcelamento",
        measured: `${(pctPublica * 100).toFixed(1)}%`,
        limit: "35%",
      });
    }
  }

  return violations;
}

export function validateProject(projectData: ProjectData): GabaritoEngineResult {
  const violations = [
    ...validateAmbientalRisco(projectData),
    ...validateZoneamento(projectData),
    ...validateCirculacao(projectData),
    ...validateEdificacoes(projectData),
    ...validateLoteamentoZeis(projectData),
  ];

  return {
    isAprovado: !violations.some((violation) => violation.severity === "CRITICAL"),
    violations,
  };
}

export function violationsToChecklistItems(violations: ProjectViolation[]): ChecklistItem[] {
  return violations
    .filter((violation) => violation.severity !== "INFO")
    .map((violation) => ({
      id: `engine_${violation.id}`,
      rotulo: violation.title,
      status: violation.severity === "CRITICAL" ? "inconforme" : "revisar",
      detalhe: `${violation.law}, ${violation.article}: ${violation.message}`,
    }));
}
