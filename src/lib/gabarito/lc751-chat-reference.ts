import { LC751_AUDIT_CONTEXT } from "@/lib/gabarito/lc751-audit-context";

/** Nome do PDF de referência citado no produto (arquivo pode ser fornecido offline / anexo). */
export const LC751_PDF_REFERENCIA_NOME = "1_lc_751_-.pdf";
export const LEGISLACAO_MUNICIPAL_REFERENCIA_NOME =
  "LC 1181/2018, LC 747/2010, LC 748/2010, LC 749/2010, LC 751/2010, LC 1247/2019, Decreto 9155/2010 e alertas de decretos revogados";

/**
 * Texto consolidado enviado ao modelo (equivale ao contexto do PDF oficial quando o arquivo não está no bundle).
 */
export function getLc751LeiTextoParaChatLlm(): string {
  return getLegislacaoMunicipalTextoParaChatLlm();
}

/**
 * Fallback operacional quando a busca vetorial não retorna trechos suficientes.
 * Não substitui o RAG: resume somente as regras já implementadas no motor.
 */
export function getLegislacaoMunicipalTextoParaChatLlm(): string {
  return [
    `Referências normativas do Gabarito: ${LEGISLACAO_MUNICIPAL_REFERENCIA_NOME}.`,
    "Trechos operacionais para o chat (sempre cite o artigo aplicável na resposta):",
    "- LC 1181/2018 (Plano Diretor): potencial construtivo, instrumentos urbanísticos e outorga onerosa quando a área construída ultrapassar o coeficiente básico aplicável.",
    "- LC 747/2010 e LC 749/2010: leitura ambiental, APP, cota, risco de cheias, parcelamento/loteamento e condicionantes territoriais.",
    "- LC 748/2010 (Sistema de Circulação): rebaixos de meio-fio, acessos veiculares, vias de loteamento, vias sem saída e praça de retorno.",
    "- Decreto 9155/2010: vias existentes e projetadas; gabarito da via significa largura total da rua, não altura de edificação.",
    "- LC 1247/2019 (Código de Edificações): pé-direito, iluminação, ventilação, escadas e ressalvas para imóvel tombado.",
    "- Decreto 9143/2010 e Decreto 9151/2010: normas revogadas; não aplicar como regra vigente, apenas alertar quando forem mencionadas.",
    "",
    `Referência normativa de zoneamento: arquivo ${LC751_PDF_REFERENCIA_NOME} (LC 751/2010, Blumenau/SC), quando disponível.`,
    LC751_AUDIT_CONTEXT,
  ].join("\n\n");
}

/** Itens para navegação / âncoras no painel do Consultor IA. */
export const LEGISLACAO_ARTICLE_NAV = [
  { anchor: "lc1181-outorga", label: "LC 1181", excerpt: "Plano Diretor, potencial construtivo e outorga onerosa." },
  { anchor: "lc747-ambiental", label: "LC 747", excerpt: "Meio ambiente, APP e condicionantes ambientais." },
  { anchor: "lc748-circulacao", label: "LC 748", excerpt: "Sistema de circulação, acessos, rebaixos e vias." },
  { anchor: "lc749-parcelamento", label: "LC 749", excerpt: "Parcelamento/loteamento, cotas e risco territorial." },
  { anchor: "art-20", label: "Art. 20", excerpt: "CA e área construída permitida." },
  { anchor: "art-21", label: "Art. 21", excerpt: "Taxa de ocupação." },
  { anchor: "art-22", label: "Art. 22", excerpt: "Área permeável mínima (20%)." },
  { anchor: "art-31", label: "Art. 31", excerpt: "Recuo frontal." },
  { anchor: "art-35", label: "Art. 35", excerpt: "Recuos H/6." },
  { anchor: "art-35a", label: "Art. 35-A", excerpt: "Afastamento de aberturas (1,50 m)." },
  { anchor: "art-41", label: "Art. 41, I", excerpt: "Uso residencial e cota 12 m." },
  { anchor: "lc1247-edificacoes", label: "LC 1247", excerpt: "Código de Edificações: compartimentos, ventilação, escadas e tombamento." },
  { anchor: "dec9155-vias", label: "Dec. 9155", excerpt: "Vias projetadas/existentes e alinhamento viário." },
  { anchor: "normas-revogadas", label: "Revogadas", excerpt: "Decretos 9143 e 9151 não devem ser aplicados como vigentes." },
] as const;

export const LC751_ARTICLE_NAV = LEGISLACAO_ARTICLE_NAV;
export type Lc751ArticleAnchor = (typeof LC751_ARTICLE_NAV)[number]["anchor"];
