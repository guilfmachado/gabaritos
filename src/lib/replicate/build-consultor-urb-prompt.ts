import { getLc751LeiTextoParaChatLlm } from "@/lib/gabarito/lc751-chat-reference";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";

export type ConsultorChatMessage = { role: "user" | "assistant"; content: string };

export type ConsultorFormContext = {
  zona_urbanistica: string;
  area_terreno_m2: number | null;
  area_construida_m2: number | null;
  area_permeavel_m2: number | null;
  uso_imovel: string;
  nome_projeto?: string;
};

function formatHistory(messages: ConsultorChatMessage[], maxTurns = 14): string {
  const slice = messages.slice(-maxTurns);
  return slice
    .map((m) => `${m.role === "user" ? "Usuário" : "Consultor"}: ${m.content.trim()}`)
    .join("\n\n");
}

export function buildConsultorUrbPrompt(input: {
  messages: ConsultorChatMessage[];
  formContext: ConsultorFormContext;
  checklistSnapshot: StatusChecklist | null;
  normaResumo: NormaLocal | null;
}): string {
  const lei = getLc751LeiTextoParaChatLlm();
  const formJson = JSON.stringify(input.formContext, null, 2);
  const normaJson = input.normaResumo ? JSON.stringify(input.normaResumo, null, 2) : "null";
  const checklistJson = input.checklistSnapshot
    ? JSON.stringify(input.checklistSnapshot, null, 2)
    : "null";
  const history = formatHistory(input.messages);

  return [
    "=== Instruções fixas ===",
    "Você é o Consultor de Auditoria Urbanística do Gabarito (Blumenau/SC).",
    "Responda em português do Brasil, com precisão técnica.",
    "OBRIGATÓRIO: sempre que aplicável, cite o dispositivo da LC 751/2010 usando negrito Markdown: **Art. X** ou **Art. X, I** ou **Art. 35-A**.",
    "Ao recomendar correções numéricas (recuos, áreas, percentuais), fundamente com o artigo correspondente (ex.: **Art. 31** recuo frontal, **Art. 35** H/6, **Art. 22** permeável 20%, **Art. 20** potencial/CA, **Art. 21** TO).",
    "Use os valores numéricos do CONTEXTO DO FORMULÁRIO abaixo como verdade do usuário para cálculos; não contradiga esses números.",
    "Se faltar dado essencial, diga o que falta antes de concluir.",
    "Não use blocos de código; texto corrido ou listas simples com hífen.",
    "",
    "=== Texto de referência da lei (trechos) ===",
    lei,
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
