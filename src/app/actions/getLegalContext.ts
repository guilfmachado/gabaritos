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
 * 3. Retorna os 3 trechos mais parecidos por padrão.
 * 4. Se embeddings/tabela/RPC falharem, usa fallback estático da LC 751 já mapeada.
 */
export async function getLegalContext(input: GetLegalContextInput): Promise<GetLegalContextResult> {
  const query = input.query?.trim();
  if (!query) {
    return getLegislacaoRagContext("regras urbanísticas LC 751 Blumenau zoneamento", {
      matchCount: input.matchCount ?? 3,
    });
  }

  return getLegislacaoRagContext(query, {
    matchCount: input.matchCount ?? 3,
  });
}
