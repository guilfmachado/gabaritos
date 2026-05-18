import { buildConsultorUrbPrompt, type ConsultorChatMessage, type ConsultorFormContext } from "@/lib/replicate/build-consultor-urb-prompt";
import { getLegalContext } from "@/app/actions/getLegalContext";
import { runLlamaAuditPrompt } from "@/lib/replicate/run-llama-text";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages?: ConsultorChatMessage[];
  form_context?: ConsultorFormContext;
  checklist_snapshot?: StatusChecklist | null;
  norma_resumo?: NormaLocal | null;
};

function lastUserContent(messages: ConsultorChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i].content?.trim() || null;
  }
  return null;
}

function buildRagQuery(messages: ConsultorChatMessage[], formContext: ConsultorFormContext): string {
  const last = lastUserContent(messages) ?? "";
  return [
    last,
    `Zona: ${formContext.zona_urbanistica || "não informada"}`,
    `Uso: ${formContext.uso_imovel || "não informado"}`,
    `Restrição uso do solo/geotecnia: ${formContext.restricao_uso_solo || "não informada"}`,
    `Imóvel tombado: ${formContext.is_tombado === true ? "sim" : formContext.is_tombado === false ? "não" : "não informado"}`,
    formContext.area_terreno_m2 != null ? `Área terreno: ${formContext.area_terreno_m2} m²` : "",
    formContext.area_construida_m2 != null ? `Área construída: ${formContext.area_construida_m2} m²` : "",
    formContext.area_permeavel_m2 != null ? `Área permeável: ${formContext.area_permeavel_m2} m²` : "",
    "Buscar em todo o acervo: LC 1181, LC 747, LC 748, LC 749, LC 751, LC 1247, Decreto 9155, Decreto 9143 revogado, Decreto 9151 revogado.",
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || !lastUserContent(messages)) {
    return NextResponse.json({ error: "Envie ao menos uma mensagem do usuário." }, { status: 400 });
  }

  const formContext: ConsultorFormContext = body.form_context ?? {
    zona_urbanistica: "",
    area_terreno_m2: null,
    area_construida_m2: null,
    area_permeavel_m2: null,
    uso_imovel: "",
    restricao_uso_solo: "",
    is_tombado: false,
  };

  try {
    const legislacao = await getLegalContext({
      query: buildRagQuery(messages, formContext),
      matchCount: 8,
    });
    const prompt = buildConsultorUrbPrompt({
      messages,
      formContext,
      checklistSnapshot: body.checklist_snapshot ?? null,
      normaResumo: body.norma_resumo ?? null,
      legislacaoContext: legislacao.context,
      legislacaoContextSource: legislacao.source,
    });

    const reply = await runLlamaAuditPrompt(prompt, 2048);
    if (!reply?.trim()) {
      return NextResponse.json({ error: "O modelo não retornou texto." }, { status: 502 });
    }
    return NextResponse.json({ reply: reply.trim() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no consultor.";
    console.error("[api/chat/consultor-urb]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
