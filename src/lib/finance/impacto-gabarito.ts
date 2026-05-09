/**
 * Estimativas de impacto operacional e financeiro (inspirado em painéis tipo MedOS).
 * Parâmetros são transparentes e calibráveis — não substituem estudo econômico-financeiro.
 */

export type ImpactoGabaritoInput = {
  /** Horas típicas de revisão técnica + ida e volta com a prefeitura por rodada */
  horasPorRodadaComuniqueSe: number;
  /** Rodadas de "Comunique-se" que o Gabarito tende a evitar antecipando inconformidades */
  rodadasEvitadas: number;
  /** Valor Geral de Vendas do empreendimento (R$) */
  vgv: number;
  /** Dias médios em que o fluxo fica parado por burocracia por rodada evitada */
  diasParalisacaoPorRodada: number;
  /** Custo de oportunidade simplificado: fração do VGV "travada" por mês de atraso (ex.: 0.002 = 0,2% ao mês) */
  taxaCustoOportunidadeMensalSobreVgv: number;
};

export type ImpactoGabaritoResult = {
  horasEconomizadas: number;
  diasAntecipados: number;
  vgvEquivalenteTravadoEvitado: number;
  formulaResumo: string;
};

export function calcularImpactoGabarito(
  p: ImpactoGabaritoInput,
): ImpactoGabaritoResult {
  const horasEconomizadas = p.horasPorRodadaComuniqueSe * p.rodadasEvitadas;
  const diasAntecipados = p.diasParalisacaoPorRodada * p.rodadasEvitadas;
  const meses = diasAntecipados / 30;
  const vgvEquivalenteTravadoEvitado =
    p.vgv * p.taxaCustoOportunidadeMensalSobreVgv * meses;

  return {
    horasEconomizadas,
    diasAntecipados,
    vgvEquivalenteTravadoEvitado,
    formulaResumo:
      "Horas = horasPorRodada × rodadasEvitadas. Estimativa financeira = VGV × taxa mensal × (dias antecipados / 30).",
  };
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
