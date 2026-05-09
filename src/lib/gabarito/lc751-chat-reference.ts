import { LC751_AUDIT_CONTEXT } from "@/lib/gabarito/lc751-audit-context";

/** Nome do PDF de referência citado no produto (arquivo pode ser fornecido offline / anexo). */
export const LC751_PDF_REFERENCIA_NOME = "1_lc_751_-.pdf";

/**
 * Texto consolidado enviado ao modelo (equivale ao contexto do PDF oficial quando o arquivo não está no bundle).
 */
export function getLc751LeiTextoParaChatLlm(): string {
  return [
    `Referência normativa principal: arquivo ${LC751_PDF_REFERENCIA_NOME} (LC 751/2010, Blumenau/SC), quando disponível.`,
    "Trechos operacionais para o chat (sempre cite o artigo aplicável na resposta):",
    LC751_AUDIT_CONTEXT,
  ].join("\n\n");
}

/** Itens para navegação / âncoras no painel do Consultor IA. */
export const LC751_ARTICLE_NAV = [
  { anchor: "art-20", label: "Art. 20", excerpt: "CA e área construída permitida." },
  { anchor: "art-21", label: "Art. 21", excerpt: "Taxa de ocupação." },
  { anchor: "art-22", label: "Art. 22", excerpt: "Área permeável mínima (20%)." },
  { anchor: "art-31", label: "Art. 31", excerpt: "Recuo frontal." },
  { anchor: "art-35", label: "Art. 35", excerpt: "Recuos H/6." },
  { anchor: "art-35a", label: "Art. 35-A", excerpt: "Afastamento de aberturas (1,50 m)." },
  { anchor: "art-41", label: "Art. 41, I", excerpt: "Uso residencial e cota 12 m." },
] as const;

export type Lc751ArticleAnchor = (typeof LC751_ARTICLE_NAV)[number]["anchor"];
