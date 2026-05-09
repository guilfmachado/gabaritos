import { buildConsultorUrbPrompt, type ConsultorChatMessage, type ConsultorFormContext } from "@/lib/replicate/build-consultor-urb-prompt";
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
  };

  try {
    const prompt = buildConsultorUrbPrompt({
      messages,
      formContext,
      checklistSnapshot: body.checklist_snapshot ?? null,
      normaResumo: body.norma_resumo ?? null,
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
