import type { ChecklistItem, PlantaAnaliseIA, StatusChecklist } from "@/types/gabarito";

/** Compatibilidade com UI legada (status / resumo / pendências). */
export function mapChecklistToPlantaAnaliseIA(checklist: StatusChecklist): PlantaAnaliseIA {
  const pendencias: string[] = [];

  for (const a of checklist.alertas_criticos ?? []) {
    pendencias.push(`${a.titulo}: ${a.mensagem}`);
  }
  if (checklist.potencial?.status === "inconforme") {
    pendencias.push(`Potencial construtivo: ${checklist.potencial.nota_tecnica}`);
  }

  for (const i of checklist.itens) {
    if (i.status === "inconforme") {
      pendencias.push(`${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`);
    } else if (i.status === "revisar") {
      pendencias.push(`(Revisar) ${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`);
    }
  }

  const bloqueio = (checklist.alertas_criticos ?? []).some((a) => a.severidade === "critico");
  const inconformeItens = checklist.itens.filter((i) => i.status === "inconforme").length;
  const status: PlantaAnaliseIA["status"] =
    bloqueio || inconformeItens > 0 || checklist.potencial?.status === "inconforme"
      ? "Pendente"
      : pendencias.length > 0
        ? "Pendente"
        : "Aprovado";

  const resumo =
    checklist.analise_bruta?.trim() ||
    checklist.divergencias_resumo?.trim() ||
    (checklist.itens.length ? "Análise concluída — ver itens e matriz no Gabarito." : "Sem resumo textual.");

  const uniq = [...new Set(pendencias)];
  return { status, resumo, pendencias: uniq.slice(0, 24) };
}

export function checklistInconformidadesForPdf(checklist: StatusChecklist): ChecklistItem[] {
  return checklist.itens.filter((i) => i.status === "inconforme" || i.status === "revisar");
}
