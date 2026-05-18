import { buildZonaLegalContext } from "@/lib/gabarito/zona-legal-context";
import type { NormaLocal } from "@/types/gabarito";

/**
 * Prompt enxuto só para visão: extração numérica/categórica da prancha (JSON).
 */
export function buildVisionExtractionPrompt(zona: string, norma: NormaLocal): string {
  const rf = norma.recuo_frontal_min;
  const zonaContext = buildZonaLegalContext(norma);
  return [
    "Você é um auditor sênior da SEPLAN de Blumenau. Analise a planta fornecida cruzando estritamente com os parâmetros da zona informada e a LC 751/2010. Se o uso for Residencial, valide agressivamente o Art. 41, I (Bloqueio abaixo da cota 12m) se aplicável.",
    "",
    "Tarefa desta etapa: EXTRAÇÃO TÉCNICA da planta (imagem). Não emita parecer jurídico completo aqui — leia objetivamente medidas, usos e indícios que alimentarão a auditoria.",
    "PRIORIDADE MÁXIMA: localizar no desenho/quadro de áreas (ou cotas) (1) a ÁREA CONSTRUÍDA TOTAL e (2) a ÁREA DE PROJEÇÃO HORIZONTAL no terreno (silhueta/pé-direito no solo, para taxa de ocupação).",
    "Esses números alimentam a Entrada Inteligente e os campos de VGV Oculto do dashboard premium; seja conservador e use null quando a leitura estiver ilegível.",
    `Zona urbanística informada: ${zona}.`,
    `Parâmetros de referência do município (compare visualmente com cotas na prancha): recuo frontal mín. ${rf} m; recuo lateral/fundos por H/6 (a verificação será feita na etapa seguinte).`,
    "",
    "=== Parâmetros dinâmicos exatos da zona (anexados pelo sistema) ===",
    zonaContext,
    "",
    "Responda APENAS com um único objeto JSON válido (sem markdown, sem texto fora do JSON), com as chaves:",
    "{",
    '  "area_construida_total_m2": number | null,',
    '  "area_projecao_horizontal_m2": number | null,',
    '  "area_construida_estimada_m2": number | null,',
    '  "taxa_ocupacao_estimada_pct": number | null,',
    '  "recuo_frontal_m": number | null,',
    '  "recuo_lateral_m": number | null,',
    '  "recuo_fundos_m": number | null,',
    '  "altura_edificacao_estimada_m": number | null,',
    '  "area_permeavel_estimada_m2": number | null,',
    '  "uso_predominante_planta": "Residencial" | "Comercial" | "Industrial" | "Misto" | "Indeterminado",',
    '  "observacoes_extracao": string',
    "}",
    "",
    "Regras:",
    "- area_construida_total_m2: soma das áreas construídas ou valor do quadro 'AC' / equivalente; número > 0 se legível; null se impossível.",
    "- area_projecao_horizontal_m2: área da projeção da edificação sobre o terreno (não confundir com área total construída em vários pavimentos); null se impossível.",
    "- area_construida_estimada_m2: use o MESMO valor de area_construida_total_m2 quando só houver um número claro; ou preencha com melhor esforço se o quadro usar outro rótulo.",
    "- taxa_ocupacao_estimada_pct: percentual (0–100) = projeção/terreno se souber área do lote na prancha; senão null ou estime a partir do desenho.",
    "- Recuos em metros a partir de cotas/legendas; null se impossível.",
    "- uso_predominante_planta: inferir pela planta (apartamentos, salas, etc.).",
    "- observacoes_extracao: notas curtas sobre escala, ilegibilidade ou quadro de áreas.",
  ].join("\n");
}
