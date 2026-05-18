import { LC751_AUDIT_CONTEXT } from "@/lib/gabarito/lc751-audit-context";
import {
  ALERTA_DECRETO_9143_REVOGADO,
  ALERTA_EGGA_RESTRICAO_GEOTECNICA,
  DECRETO_9143_2010,
  DECRETO_9151_2010,
} from "@/lib/gabarito/normas-revogadas";
import { LC748_2010 } from "@/lib/gabarito/circulacao-lc748";
import { ALERTA_IMOVEL_TOMBADO_LC1247, LC1247_2019 } from "@/lib/gabarito/edificacoes-lc1247";
import { DECRETO_9155_2010 } from "@/lib/gabarito/sistema-viario";
import { LC751_2010 } from "@/lib/gabarito/zoneamento-lc751";
import { areaPermeavelParaPercentual, taxaOcupacaoParaPercentual } from "@/lib/gabarito/taxa-ocupacao";
import { buildZonaLegalContext } from "@/lib/gabarito/zona-legal-context";
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
  restricaoUsoSolo?: string | null;
  isTombado?: boolean;
};

/**
 * Prompt para Llama 3 70B: auditoria jurídica com base na extração visual + LC 751.
 */
export function buildLegalAuditPrompt(input: LegalAuditPromptInput): string {
  const { zona, norma, extracao, areaTerrenoM2, metricas, areaConstruidaProjetoM2, areaPermeavelPropostaM2, usoImovelDeclarado, restricaoUsoSolo, isTombado } =
    input;
  const toPct = taxaOcupacaoParaPercentual(norma.taxa_ocupacao_max);
  const ca = norma.indice_aproveitamento_max;
  const permPct = areaPermeavelParaPercentual(norma.area_permeavel_min);
  const limiteCa = areaTerrenoM2 * ca;
  const mJson = metricas ? JSON.stringify(metricas, null, 2) : "null";
  const extJson = JSON.stringify(extracao, null, 2);
  const zonaContext = buildZonaLegalContext(norma);

  return [
    "Você é um auditor sênior da SEPLAN de Blumenau. Analise a planta fornecida cruzando estritamente com os parâmetros da zona informada e a LC 751/2010. Se o uso for Residencial, valide agressivamente o Art. 41, I (Bloqueio abaixo da cota 12m) se aplicável.",
    "Você recebeu a EXTRAÇÃO VISUAL da prancha (JSON) já produzida por modelo de visão.",
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
    "=== Parâmetros dinâmicos exatos da zona (anexados pelo sistema) ===",
    zonaContext,
    "",
    "=== Métricas pré-calculadas no servidor (m²) ===",
    mJson,
    "",
    "=== Extração visual (JSON) ===",
    extJson,
    "",
    "=== Declarações do usuário (valores finais — prevalecem para potencial e VGV) ===",
    `Uso declarado: ${usoImovelDeclarado ?? "não informado"}`,
    `Restrição geotécnica/uso do solo declarada: ${restricaoUsoSolo ?? "não informada"}`,
    `Imóvel tombado: ${isTombado ? "sim" : "não"}`,
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
    `5) NÃO aplique como regra vigente a fórmula ${DECRETO_9143_2010.formulaRevogada} do ${DECRETO_9143_2010.titulo}: status ${DECRETO_9143_2010.status}, revogado pelo ${DECRETO_9143_2010.revogadoPor}. Se ela aparecer em dados fornecidos pelo usuário, gere alerta_critico com codigo ${ALERTA_DECRETO_9143_REVOGADO.codigo} e a mensagem: ${DECRETO_9143_2010.mensagem}`,
    `6) NÃO aplique o ${DECRETO_9151_2010.titulo} como norma vigente: status ${DECRETO_9151_2010.status}, revogado pelo ${DECRETO_9151_2010.revogadoPor}. Se a restrição declarada for Em Estudo ou Interditado, gere alerta_critico com codigo ${ALERTA_EGGA_RESTRICAO_GEOTECNICA.codigo} exigindo EGGA assinado por profissional com CREA e análise do órgão municipal competente.`,
    `7) ${DECRETO_9155_2010.titulo}: quando mencionar alinhamento/recuo frontal junto ao sistema viário, trate "gabarito da via" como largura total da rua (passeios + pista), nunca como altura da edificação. Em via simétrica, o alinhamento estimado fica em gabarito/2 a partir do eixo da via; em via assimétrica ou em desnível, exija projeto oficial da via e não presuma metade do gabarito.`,
    `8) ${LC748_2010.titulo}: se a planta indicar rebaixos de meio-fio, garagens, loteamento, novas vias ou vias sem saída, valide como infração direta da LC 748/2010: soma dos rebaixos <= 50% da testada (Art. 11); rebaixo individual <= 7,20 m salvo posto/logística; rebaixo entre 3,61 m e 7,20 m exige 1,00 m da divisa; múltiplos rebaixos exigem 5,00 m entre si; loteamento residencial exige gabarito de via mínimo 13,00 m até 400 m e 15,00 m acima de 400 m; via sem saída > 30,00 m exige praça de retorno com raio mínimo 7,50 m.`,
    `9) ${LC1247_2019.titulo}: valide pé-direito mínimo de 2,40 m para permanência prolongada e 2,20 m para transitórios; iluminação A/6 e ventilação A/12 em quartos/salas; iluminação A/8 e ventilação A/16 em transitórios; escadas coletivas com largura mínima 1,20 m, espelho máximo 18 cm, piso mínimo 28 cm e Blondel 2h+b entre 63 cm e 64 cm. Se imóvel tombado = sim, NÃO gere inconformidades automáticas da LC 1247; gere apenas alerta com codigo ${ALERTA_IMOVEL_TOMBADO_LC1247.codigo} e mensagem: ${ALERTA_IMOVEL_TOMBADO_LC1247.mensagem}`,
    `10) ${LC751_2010.titulo}: valide deterministicamente TO, permeabilidade, recuo frontal e divisas. TO = projeção horizontal / área do terreno e não pode exceder a taxa da zona. Art. 22: área permeável mínima absoluta de 20% do terreno, salvo regra mais restritiva da zona. Art. 31: recuo frontal mínimo padrão de 5,00 m a partir do alinhamento predial. Art. 35: se afastamento lateral for 0, a parede na divisa deve ser cega; se houver janela/vão/abertura, marque inconforme.`,
    "",
    "=== Formato de saída (JSON único, sem markdown) ===",
    "Responda APENAS com JSON contendo:",
    "analise_texto (string), divergencias_resumo (string),",
    "matriz_conformidade: [{ medida_identificada, regra_lc751, origem_legal, status_conformidade: conforme|inconforme|revisar }],",
    "origem_legal deve indicar a fonte rastreável, ex.: Plano Diretor - Art. 20, LC 751/2010 - Art. 31, Zoneamento - Zona " + zona + ".",
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
