/** `taxa_ocupacao_max` na base pode estar em fração (0,60) ou em percentagem (60). */
export function taxaOcupacaoParaPercentual(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

/** Fração 0–1 quando a norma estiver em percentagem (>1 trata-se como % legado). */
export function taxaOcupacaoParaFracao(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

/** `taxa_permeabilidade_min` em fração ou % — devolve % para texto ao utilizador. */
export function areaPermeavelParaPercentual(n: number): number {
  return taxaOcupacaoParaPercentual(n);
}

/** Fração 0–1 para multiplicar pelo terreno (m² permeável mínimo). */
export function areaPermeavelMinParaFracao(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}
