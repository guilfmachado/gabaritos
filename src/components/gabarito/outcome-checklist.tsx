"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChecklistItem, ChecklistStatus } from "@/types/gabarito";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

function rowStyle(status: ChecklistStatus) {
  switch (status) {
    case "conforme":
      return {
        wrap: "border-emerald-100 bg-emerald-50",
        icon: <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />,
        badge: "text-emerald-600",
        label: "Validado",
      };
    case "inconforme":
      return {
        wrap: "border-red-100 bg-red-50",
        icon: <AlertCircle className="size-5 shrink-0 text-red-500" aria-hidden />,
        badge: "text-red-600",
        label: "Pendência",
      };
    default:
      return {
        wrap: "border-amber-100 bg-amber-50",
        icon: <HelpCircle className="size-5 shrink-0 text-amber-600" aria-hidden />,
        badge: "text-amber-700",
        label: "Revisar",
      };
  }
}

export function OutcomeChecklist({ itens, zonaLabel }: { itens: ChecklistItem[]; zonaLabel: string }) {
  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">
        Arraste uma planta e use <span className="font-medium text-slate-700">Analisar com IA</span> para
        preencher o checklist urbanístico ({zonaLabel}).
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[min(52vh,520px)] pr-3">
      <ul className="space-y-4">
        {itens.map((item, idx) => {
          const s = rowStyle(item.status);
          return (
            <li
              key={`${item.id}-${idx}`}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${s.wrap}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {s.icon}
                <span className="font-medium text-slate-800">{item.rotulo}</span>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${s.badge}`}>
                {item.status === "inconforme" && item.detalhe ? item.detalhe : s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
