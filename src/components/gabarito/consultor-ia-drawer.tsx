"use client";

import { ConsultorFormattedBubble } from "@/components/gabarito/consultor-formatted-bubble";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LEGISLACAO_ARTICLE_NAV, LEGISLACAO_MUNICIPAL_REFERENCIA_NOME } from "@/lib/gabarito/lc751-chat-reference";
import type { ConsultorChatMessage, ConsultorFormContext } from "@/lib/replicate/build-consultor-urb-prompt";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";
import { BookOpen, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const QUICK_ACTIONS = [
  { label: "Como otimizar meu VGV?", text: "Como otimizar meu VGV com base nos meus dados e no conjunto de leis municipais aplicáveis? Cite os artigos." },
  { label: "Erro de recuo?", text: "Onde pode estar o erro de recuo na minha análise? Explique recuo frontal e laterais com os artigos corretos." },
  { label: "Regras do Art. 41", text: "Quais são as regras do Art. 41, I da LC 751/2010 no meu caso (uso e zona)?" },
  { label: "Acesso/rebaixo", text: "Meus acessos veiculares e rebaixos atendem a LC 748/2010? O que devo conferir?" },
  { label: "Edificações", text: "Quais pontos da LC 1247/2019 devo revisar em compartimentos, ventilação, iluminação e escadas?" },
  { label: "Permeável mínimo", text: "Qual o mínimo de área permeável que preciso respeitar e como calcular com meu terreno?" },
  { label: "GEO Blumenau", text: "Como uso o GEO Blumenau para conferir lote, zoneamento e Consulta para Construir antes de protocolar?" },
] as const;

export type ConsultorIADrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formContext: ConsultorFormContext;
  checklistSnapshot: StatusChecklist | null;
  normaResumo: NormaLocal | null;
};

export function ConsultorIADrawer({
  open,
  onOpenChange,
  formContext,
  checklistSnapshot,
  normaResumo,
}: ConsultorIADrawerProps) {
  const [messages, setMessages] = useState<ConsultorChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const articleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Olá! Sou o **Consultor IA** de auditoria urbanística. Tenho acesso aos campos que você preencheu, à norma da zona, ao JSON da última análise e ao RAG jurídico. Pergunte à vontade — citarei os artigos aplicáveis do acervo municipal (**" +
            LEGISLACAO_MUNICIPAL_REFERENCIA_NOME +
            "**). Para cadastro, lote, Consulta para Construir, mapas temáticos ou dados WFS, use também o **GEO Blumenau**: https://geo.blumenau.sc.gov.br.",
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const scrollToArticle = useCallback((anchor: string) => {
    const el = articleRefs.current[anchor];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      setError(null);
      const nextMessages: ConsultorChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/chat/consultor-urb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            form_context: formContext,
            checklist_snapshot: checklistSnapshot,
            norma_resumo: normaResumo,
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Falha no consultor.");
        const reply = data.reply?.trim();
        if (!reply) throw new Error("Resposta vazia.");
        setMessages([...nextMessages, { role: "assistant", content: reply }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido.");
      } finally {
        setLoading(false);
      }
    },
    [checklistSnapshot, formContext, loading, messages, normaResumo],
  );

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[75] bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
        aria-label="Fechar consultor"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className="fixed right-0 top-0 z-[76] flex h-full w-full max-w-md flex-col border-l border-slate-200/90 bg-slate-50 shadow-[-12px_0_40px_-12px_rgba(15,23,42,0.18)] lg:max-w-[420px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consultor-ia-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 bg-white/90 px-4 py-3 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
              <MessageCircle className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="consultor-ia-title" className="truncate text-sm font-semibold tracking-tight text-slate-900">
                Consultor IA
              </h2>
              <p className="truncate text-[11px] text-slate-500">Leis municipais · Llama 3 70B</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-slate-600" onClick={() => onOpenChange(false)}>
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 px-3 py-3">
            <div className="space-y-3 pr-2">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl border px-3.5 py-2.5 shadow-sm ${
                      m.role === "user"
                        ? "border-emerald-200/80 bg-emerald-600 text-white"
                        : "border-slate-200/90 border-l-[3px] border-l-emerald-500/90 bg-white text-slate-800"
                    }`}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>
                    ) : (
                      <ConsultorFormattedBubble content={m.content} onArticleNavigate={scrollToArticle} />
                    )}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-600 shadow-sm">
                    <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />
                    Consultando normas…
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-slate-200/90 bg-slate-50 px-3 py-2">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">Perguntas rápidas</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(q.text)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/80 hover:text-emerald-900 disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200/90 bg-white px-3 py-3">
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ex.: Meu rebaixo, recuo ou escada atende a lei?"
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-500/20 placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2"
              />
              <Button
                type="button"
                className="h-auto shrink-0 self-end bg-emerald-600 hover:bg-emerald-700"
                disabled={loading || !input.trim()}
                onClick={() => void sendMessage(input)}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="max-h-[28vh] shrink-0 overflow-y-auto border-t border-slate-200/90 bg-slate-100/80 px-3 py-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              <BookOpen className="size-3.5" aria-hidden />
              Referências legais (trechos)
            </div>
            <div className="space-y-1.5">
              {LEGISLACAO_ARTICLE_NAV.map((item) => (
                <div
                  key={item.anchor}
                  ref={(el) => {
                    articleRefs.current[item.anchor] = el;
                  }}
                  className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-slate-700 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => scrollToArticle(item.anchor)}
                    className="font-semibold text-emerald-900 underline decoration-emerald-400 decoration-2 underline-offset-2 hover:text-emerald-950"
                  >
                    {item.label}
                  </button>
                  <span className="text-slate-600"> — {item.excerpt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
