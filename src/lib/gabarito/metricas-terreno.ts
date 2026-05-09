import { areaPermeavelMinParaFracao, taxaOcupacaoParaFracao } from "@/lib/gabarito/taxa-ocupacao";
import type { NormaLocal } from "@/types/gabarito";

/** Limites físicos pré-calculados no servidor antes da Replicate (LC 751 / parâmetros da zona). */
export type MetricasTerrenoPrecomputadas = {
  area_terreno_m2: number;
  /** Terreno × `indice_aproveitamento_max` (CA). */
  area_maxima_construida_m2: number;
  /** Terreno × taxa de ocupação máxima (fração ou % normalizada). */
  area_projecao_maxima_m2: number;
  /** Terreno × `area_permeavel_min` (ex.: Art. 22 — fração mínima permeável). */
  area_permeavel_necessaria_m2: number;
};

export function computeMetricasTerreno(areaTerrenoM2: number, norma: NormaLocal): MetricasTerrenoPrecomputadas {
  const toFrac = taxaOcupacaoParaFracao(norma.taxa_ocupacao_max);
  const permFrac = areaPermeavelMinParaFracao(norma.area_permeavel_min);
  return {
    area_terreno_m2: areaTerrenoM2,
    area_maxima_construida_m2: areaTerrenoM2 * norma.indice_aproveitamento_max,
    area_projecao_maxima_m2: areaTerrenoM2 * toFrac,
    area_permeavel_necessaria_m2: areaTerrenoM2 * permFrac,
  };
}

/** Potencial não utilizado (m²): limite de área construída (CA × terreno) menos estimativa da IA. */
export function computeAreaRestantePotencialM2(
  metricas: MetricasTerrenoPrecomputadas,
  areaConstruidaEstimadaIaM2: number | null | undefined,
): number | null {
  if (areaConstruidaEstimadaIaM2 == null || !Number.isFinite(areaConstruidaEstimadaIaM2)) {
    return null;
  }
  return Math.round(Math.max(0, metricas.area_maxima_construida_m2 - areaConstruidaEstimadaIaM2) * 100) / 100;
}
