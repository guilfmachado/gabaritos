import { areaPermeavelParaPercentual, taxaOcupacaoParaPercentual } from "@/lib/gabarito/taxa-ocupacao";
import type { NormaLocal } from "@/types/gabarito";

export function buildZonaLegalContext(norma: NormaLocal): string {
  const zona = norma.zona_urbanistica;
  const caBasico = norma.coeficiente_aproveitamento_basico;
  const caMaximo = norma.coeficiente_aproveitamento_maximo;
  const toPct = taxaOcupacaoParaPercentual(norma.taxa_ocupacao);
  const permPct = areaPermeavelParaPercentual(norma.taxa_permeabilidade);
  const recuoFrontal = norma.recuo_frontal;
  const afastamento = norma.afastamento_lateral_fundos;

  return [
    `Zona ${zona} — parâmetros oficiais para cruzamento estrito:`,
    `- Plano Diretor / Zoneamento — Art. 20: coeficiente de aproveitamento básico ${caBasico}; máximo ${caMaximo}.`,
    `- Plano Diretor / Zoneamento — Art. 21: taxa de ocupação ${toPct}%.`,
    `- LC 751/2010 — Art. 22: taxa de permeabilidade mínima ${permPct}%.`,
    `- LC 751/2010 — Art. 31: recuo frontal mínimo ${recuoFrontal} m.`,
    `- LC 751/2010 — Art. 35: afastamento lateral/fundos ${afastamento}.`,
    norma.observacao ? `- Observação cadastrada da zona: ${norma.observacao}` : "",
  ].filter(Boolean).join("\n");
}

export function origemLegalParaRegra(medida: string, regra: string, zona: string): string {
  const t = `${medida} ${regra}`.toLowerCase();
  if (t.includes("coef") || t.includes("aproveitamento") || t.includes("ca")) {
    return `Plano Diretor - Art. 20 / Zoneamento - Zona ${zona}`;
  }
  if (t.includes("taxa") && t.includes("ocup")) {
    return `Plano Diretor - Art. 21 / Zoneamento - Zona ${zona}`;
  }
  if (t.includes("perme")) return "LC 751/2010 - Art. 22";
  if (t.includes("frontal")) return `LC 751/2010 - Art. 31 / Zoneamento - Zona ${zona}`;
  if (t.includes("lateral") || t.includes("fundo") || t.includes("h/6")) return "LC 751/2010 - Art. 35";
  if (t.includes("residencial") || t.includes("cota") || t.includes("enchente") || t.includes("apr") || t.includes("arco")) {
    return "LC 751/2010 - Art. 41, I";
  }
  return `Zoneamento - Zona ${zona}`;
}
