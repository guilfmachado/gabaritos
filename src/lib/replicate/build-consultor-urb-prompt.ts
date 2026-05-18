import type { NormaLocal, StatusChecklist } from "@/types/gabarito";

export type ConsultorChatMessage = { role: "user" | "assistant"; content: string };

export type ConsultorFormContext = {
  zona_urbanistica: string;
  area_terreno_m2: number | null;
  area_construida_m2: number | null;
  area_permeavel_m2: number | null;
  uso_imovel: string;
  restricao_uso_solo?: string | null;
  is_tombado?: boolean | null;
  nome_projeto?: string;
};

function formatHistory(messages: ConsultorChatMessage[], maxTurns = 14): string {
  const slice = messages.slice(-maxTurns);
  return slice
    .map((m) => `${m.role === "user" ? "Usuário" : "Consultor"}: ${m.content.trim()}`)
    .join("\n\n");
}

function sourceInstruction(source: "rag" | "fallback"): string {
  if (source === "rag") {
    return "Você é um auditor sênior da SEPLAN de Blumenau. Responda à dúvida do usuário com base na planta do projeto e usando EXCLUSIVAMENTE o contexto real das Leis Municipais anexado abaixo. Considere todo o acervo recuperado: Plano Diretor LC 1181/2018, legislação ambiental/parcelamento LC 747/2010 e LC 749/2010, circulação LC 748/2010, zoneamento LC 751/2010, edificações LC 1247/2019, Decreto 9155/2010 e alertas sobre decretos revogados. Cite sempre os artigos correspondentes. Se o contexto anexado não contiver base suficiente para responder, diga que a base vetorial não trouxe trecho suficiente e peça complemento, sem inventar norma.";
  }
  return "Você é um auditor sênior da SEPLAN de Blumenau. A busca vetorial não trouxe trechos reais suficientes; responda apenas com o fallback básico do ecossistema municipal já mapeado abaixo, sinalizando que é uma orientação preliminar e que o documento oficial deve ser consultado antes de protocolo.";
}

export function buildConsultorUrbPrompt(input: {
  messages: ConsultorChatMessage[];
  formContext: ConsultorFormContext;
  checklistSnapshot: StatusChecklist | null;
  normaResumo: NormaLocal | null;
  legislacaoContext: string;
  legislacaoContextSource: "rag" | "fallback";
}): string {
  const formJson = JSON.stringify(input.formContext, null, 2);
  const normaJson = input.normaResumo ? JSON.stringify(input.normaResumo, null, 2) : "null";
  const checklistJson = input.checklistSnapshot
    ? JSON.stringify(input.checklistSnapshot, null, 2)
    : "null";
  const history = formatHistory(input.messages);

  return [
    "=== Instruções fixas ===",
    sourceInstruction(input.legislacaoContextSource),
    "Responda em português do Brasil, com precisão técnica.",
    "OBRIGATÓRIO: sempre que aplicável, cite o dispositivo legal usando negrito Markdown: **Art. X** ou **Art. X, I** ou **Art. 35-A**.",
    "Ao recomendar correções numéricas (recuos, áreas, percentuais, rebaixos, vias, compartimentos, escadas, APP, loteamento, outorga), fundamente com a lei e o artigo correspondente. Exemplos: LC 751 para zoneamento, LC 748 para circulação, LC 1247 para edificações, LC 747/749 para ambiental/parcelamento e LC 1181 para outorga.",
    "Não reduza a resposta à LC 751 se a pergunta envolver outra lei. Escolha a norma aplicável pelo tema: zoneamento, circulação, edificações, parcelamento, ambiental, via projetada, outorga ou norma revogada.",
    "Decreto 9143/2010 e Decreto 9151/2010 devem ser tratados como revogados quando aparecerem; não os aplique como regra vigente.",
    "Use o CONTEXTO JURÍDICO RECUPERADO abaixo como base normativa da resposta.",
    "Use os valores numéricos do CONTEXTO DO FORMULÁRIO abaixo como verdade do usuário para cálculos; não contradiga esses números.",
    "Quando a dúvida depender de dados cadastrais, lote, zoneamento visual, Consulta para Construir, mapas temáticos ou WFS, oriente o usuário a conferir no GEO Blumenau: https://geo.blumenau.sc.gov.br. Não substitua a lei pelo mapa; use o GEO como fonte operacional de evidência espacial.",
    "Se faltar dado essencial, diga o que falta antes de concluir.",
    "Não use blocos de código; texto corrido ou listas simples com hífen.",
    "",
    `=== Contexto jurídico recuperado (${input.legislacaoContextSource}) ===`,
    input.legislacaoContext,
    "",
    "=== Contexto do formulário (tempo real) ===",
    formJson,
    "",
    "=== Parâmetros cadastrados da zona (norma local) ===",
    normaJson,
    "",
    "=== JSON da análise atual (checklist / extração / alertas) ===",
    checklistJson,
    "",
    "=== Histórico da conversa ===",
    history,
    "",
    "Responda à última mensagem do usuário de forma completa e fundamentada nos artigos citados.",
  ].join("\n");
}
