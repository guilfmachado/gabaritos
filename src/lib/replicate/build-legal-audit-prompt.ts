import { LC751_AUDIT_CONTEXT } from "@/lib/gabarito/lc751-audit-context";
import { areaPermeavelParaPercentual, taxaOcupacaoParaPercentual } from "@/lib/gabarito/taxa-ocupacao";
import type { ExtracaoVisaoLlama, NormaLocal } from "@/types/gabarito";
import type { MetricasTerrenoPrecomputadas } from "@/lib/gabarito/metricas-terreno";

export type LegalAuditPromptInput = {
  zona: string;
  norma: NormaLocal;
  extracao: ExtracaoVisaoLlama;
  areaTerrenoM2: number;
  metricas: MetricasTerrenoPrecomputadas | null;
  areaConstruidaProjetoM2?: number | null;
  areaPermeavelPropostaM2?: number | null;
  usoImovelDeclarado?: string | null;
};

/**
 * Prompt para Llama 3 70B: auditoria jurídica com base na extração visual + LC 751.
 */
export function buildLegalAuditPrompt(input: LegalAuditPromptInput): string {
  const { zona, norma, extracao, areaTerrenoM2, metricas, areaConstruidaProjetoM2, areaPermeavelPropostaM2, usoImovelDeclarado } =
    input;
  const toPct = taxaOcupacaoParaPercentual(norma.taxa_ocupacao_max);
  const ca = norma.indice_aproveitamento_max;
  const permPct = areaPermeavelParaPercentual(norma.area_permeavel_min);
  const limiteCa = areaTerrenoM2 * ca;
  const mJson = metricas ? JSON.stringify(metricas, null, 2) : "null";
  const extJson = JSON.stringify(extracao, null, 2);

  return [
    "Você é auditor jurídico-urbanístico municipal (Blumenau/SC). Recebeu a EXTRAÇÃO VISUAL da prancha (JSON) já produzida por modelo de visão.",
    "Sua tarefa é AUDITORIA conforme LC 751/2010: comparar extração + dados declarados com a lei e com os parâmetros da zona.",
    "",
    "=== Texto normativo de referência (LC 751/2010 — trechos) ===",
    LC751_AUDIT_CONTEXT,
    "",
    "=== Dados da zona e do terreno ===",
    `Zona: ${zona}`,
    `Área do terreno (m²): ${areaTerrenoM2}`,
    `Recuo frontal mín. (tabela): ${norma.recuo_frontal_min} m`,
    `Recuo lateral mín. (tabela): ${norma.recuo_lateral_min} m`,
    `TO máx.: ${toPct}%`,
    `CA máx.: ${ca}`,
    `Área permeável mínima exigida (% sobre terreno): ${permPct}%`,
    `Limite indicativo área construída (terreno × CA): ${limiteCa.toFixed(2)} m²`,
    "",
    "=== Métricas pré-calculadas no servidor (m²) ===",
    mJson,
    "",
    "=== Extração visual (JSON) ===",
    extJson,
    "",
    "=== Declarações do usuário (valores finais — prevalecem para potencial e VGV) ===",
    `Uso declarado: ${usoImovelDeclarado ?? "não informado"}`,
    `Área construída (confirmada/ajustada pelo usuário): ${areaConstruidaProjetoM2 != null ? `${areaConstruidaProjetoM2} m²` : "não informada"}`,
    `Área permeável (confirmada/ajustada pelo usuário): ${areaPermeavelPropostaM2 != null ? `${areaPermeavelPropostaM2} m²` : "não informada"}`,
    "Use esses valores para calcular o potencial indicativo (terreno × CA da zona) e para otimização de VGV; cruze com a extração visual.",
    "",
    "=== Obrigações de raciocínio ===",
    "0) Taxa de ocupação (Art. 21): se a extração trouxer area_projecao_horizontal_m2 e você tiver área do terreno, compare projeção/terreno com o TO máximo da zona. Se só houver taxa_ocupacao_estimada_pct, use como referência.",
    "1) Art. 35: com a altura H estimada na extração (ou inferida), calcule recuo mínimo H/6 e compare com recuos laterais/fundos extraídos. Ex.: H=18 m → 3 m. Registre inconformidades na matriz e no parecer.",
    "2) Art. 41, I: se uso for Residencial (declarado ou predominante na extração) e zona for APR/ARCO ou houver risco/cota baixa inferível, inclua alertas_criticos com mensagem contendo EXATAMENTE: Proibido uso residencial abaixo da cota 12m",
    "3) Art. 22: valide 20% de permeável usando área do terreno, área permeável da extração e/ou declarada e o mínimo do servidor.",
    "4) Art. 20 / potencial: use a área construída FINAL do usuário (quando informada) para (limite terreno×CA − área utilizada). Se houver folga, preencha otimizacao_sugestao_ia com ganhos de VGV, citando Art. 20, TO (Art. 21), recuos e permeável; cite Art. 35-A (1,50 m) para novas aberturas.",
    "",
    "=== Formato de saída (JSON único, sem markdown) ===",
    "Responda APENAS com JSON contendo:",
    "analise_texto (string), divergencias_resumo (string),",
    "matriz_conformidade: [{ medida_identificada, regra_lc751, status_conformidade: conforme|inconforme|revisar }],",
    "itens: [{ id, rotulo, status: conforme|inconforme|revisar, detalhe? }],",
    "area_construida_estimada_ia_m2 (número, use extração se consistente),",
    "altura_edificacao_estimada_m (número ou null),",
    "divergencia_area_declarada_m2 (número ou null),",
    "inferencia_area_potencial_risco (boolean), inferencia_cota_enchente_12m (boolean), inferencia_uso_residencial (boolean),",
    "otimizacao_sugestao_ia (string),",
    "parecer_tecnico_llama (string) — parecer humano citando artigos para cada falha ou declarando conformidade,",
    "alertas_criticos opcional: [{ codigo, severidade: critico|alerta, titulo, mensagem }].",
    "",
    "Não inclua comentários fora do JSON.",
  ].join("\n");
}
