"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ChecklistItem, ChecklistStatus } from "@/types/gabarito";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

function statusMeta(status: ChecklistStatus) {
  switch (status) {
    case "conforme":
      return {
        label: "Cumprido",
        Icon: CheckCircle2,
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        dot: "bg-emerald-500",
      };
    case "inconforme":
      return {
        label: "Inconformidade",
        Icon: AlertCircle,
        className: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
        dot: "bg-red-500",
      };
    default:
      return {
        label: "Revisar",
        Icon: HelpCircle,
        className: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        dot: "bg-amber-500",
      };
  }
}

export function ChecklistPanel({
  itens,
  divergencias,
  analise,
}: {
  itens: ChecklistItem[];
  divergencias?: string;
  analise?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {analise ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{analise}</p>
      ) : null}
      {divergencias ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm">
          <span className="font-medium text-foreground">Ralos / divergências: </span>
          {divergencias}
        </div>
      ) : null}
      <Separator />
      <ScrollArea className="min-h-[280px] flex-1 pr-3">
        <ul className="space-y-2">
          {itens.length === 0 ? (
            <li className="text-muted-foreground text-sm">
              Nenhum item estruturado ainda. Rode a análise por visão ou aguarde o retorno do modelo.
            </li>
          ) : (
            itens.map((item) => {
              const m = statusMeta(item.status);
              const Icon = m.Icon;
              return (
                <li
                  key={item.id}
                  className={`flex gap-3 rounded-xl border p-3 ${m.className}`}
                >
                  <span className={`mt-1 size-2.5 shrink-0 rounded-full ${m.dot}`} aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.rotulo}</span>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Icon className="size-3.5" />
                        {m.label}
                      </Badge>
                    </div>
                    {item.detalhe ? (
                      <p className="text-muted-foreground text-xs leading-relaxed">{item.detalhe}</p>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}
