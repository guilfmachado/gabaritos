/**
 * Prompt alinhado ao Gabarito / Prefeitura de Blumenau + formato JSON para checklist.
 */
export function buildPrefeituraBlumenauPrompt(
  zona: string,
  recuoFrontalMinM: number,
  taxaOcupacaoMaxPct: number,
): string {
  const base =
    "Você é um analista técnico da prefeitura de Blumenau. " +
    "Analise esta imagem de planta baixa. " +
    `Regras para esta zona ${zona}: Recuo Frontal mínimo de ${recuoFrontalMinM}m e Taxa de Ocupação máxima de ${taxaOcupacaoMaxPct}%. ` +
    "Verifique se o desenho respeita estas normas e liste em formato JSON as divergências encontradas.";

  const jsonSpec =
    " Responda somente com um objeto JSON válido, sem markdown, no formato: " +
    '{"resumo":"síntese em uma frase","divergencias":[' +
    '{"id":"slug-unico","rotulo":"nome da verificação","conforme":true ou false,"detalhe":"justificativa curta"}]}' +
    " Use conforme true quando a prancha indicar atendimento à regra, false quando houver inconformidade ou dúvida relevante.";

  return base + jsonSpec;
}
