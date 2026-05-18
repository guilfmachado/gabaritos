"use server";

import { getLegislacaoRagContext, type DocumentoLegislacaoMatch } from "@/lib/gabarito/rag-legislacao";

export type GetLegalContextInput = {
  /** Pergunta do usuário ou resumo do erro/achado da planta. */
  query: string;
  /** Quantidade de parágrafos/trechos legais mais similares. Padrão: 3. */
  matchCount?: number;
};

export type GetLegalContextResult = {
  context: string;
  matches: DocumentoLegislacaoMatch[];
  source: "rag" | "fallback";
};

/**
 * Busca semântica jurídica para o Gabarito.
 *
 * Fluxo:
 * 1. Gera embedding da pergunta/contexto com OPENAI_API_KEY (ou OPENAI_EMBEDDING_MODEL).
 * 2. Consulta Supabase RPC `match_documentos_legislacao`.
 * 3. Retorna os trechos legais mais parecidos.
 * 4. Se embeddings/tabela/RPC falharem, usa fallback estático do ecossistema municipal já mapeado.
 */
export async function getLegalContext(input: GetLegalContextInput): Promise<GetLegalContextResult> {
  const query = input.query?.trim();
  if (!query) {
    return getLegislacaoRagContext("leis urbanísticas Blumenau LC 1181 LC 747 LC 748 LC 749 LC 751 LC 1247 Decreto 9155 normas revogadas", {
      matchCount: input.matchCount ?? 8,
    });
  }

  return getLegislacaoRagContext(query, {
    matchCount: input.matchCount ?? 8,
  });
}
