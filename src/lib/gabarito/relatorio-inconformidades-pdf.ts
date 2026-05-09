import type { StatusChecklist } from "@/types/gabarito";
import { jsPDF } from "jspdf";

export type RelatorioPdfOpts = {
  zona: string;
  nomeProjeto?: string;
  checklist: StatusChecklist;
};

/** Gera e descarrega PDF com inconformidades, alertas e potencial (pré-análise). */
export function downloadRelatorioInconformidadesPdf(opts: RelatorioPdfOpts): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const maxW = pageW - margin * 2;
  let y = 48;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = 48;
    }
  };

  doc.setFontSize(16);
  doc.text("Gabarito — relatório de pré-análise", margin, y);
  y += 26;
  doc.setFontSize(10);
  doc.text(`Zona: ${opts.zona}  |  Projeto: ${opts.nomeProjeto?.trim() || "—"}`, margin, y);
  y += 16;
  doc.text(`Emitido: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 28;

  if (opts.checklist.alertas_criticos?.length) {
    newPageIfNeeded(80);
    doc.setFontSize(12);
    doc.setTextColor(160, 0, 0);
    doc.text("Alertas", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 16;
    doc.setFontSize(9);
    for (const a of opts.checklist.alertas_criticos) {
      const block = doc.splitTextToSize(`${a.titulo}: ${a.mensagem}`, maxW);
      newPageIfNeeded(block.length * 12 + 8);
      doc.text(block, margin, y);
      y += block.length * 12 + 8;
    }
    y += 8;
  }

  if (opts.checklist.potencial) {
    newPageIfNeeded(100);
    doc.setFontSize(12);
    doc.text("Potencial construtivo (indicativo — terreno × CA)", margin, y);
    y += 16;
    doc.setFontSize(9);
    const p = opts.checklist.potencial;
    const lines = [
      `Área do terreno declarada: ${p.area_terreno_m2} m²`,
      `Coeficiente de aproveitamento máximo: ${p.coeficiente_aproveitamento_max}`,
      `Limite indicativo de área construída: ${p.limite_area_construida_m2.toFixed(1)} m²`,
      p.area_construida_estimada_ia_m2 != null
        ? `Estimativa pela IA: ${p.area_construida_estimada_ia_m2.toFixed(1)} m² (${p.utilizacao_coeficiente_pct != null ? `${p.utilizacao_coeficiente_pct.toFixed(0)}%` : "—"} do limite)`
        : "Estimativa pela IA: não informada",
      `Situação: ${p.status} — ${p.nota_tecnica}`,
    ];
    for (const line of lines) {
      newPageIfNeeded(20);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 12;
  }

  if (opts.checklist.matriz_conformidade?.length) {
    newPageIfNeeded(40);
    doc.setFontSize(12);
    doc.text("Matriz (medida × regra × conformidade)", margin, y);
    y += 16;
    doc.setFontSize(8);
    for (const row of opts.checklist.matriz_conformidade) {
      const t = doc.splitTextToSize(
        `• ${row.medida_identificada} | Regra: ${row.regra_lc751} | ${row.status_conformidade}`,
        maxW,
      );
      newPageIfNeeded(t.length * 11 + 6);
      doc.text(t, margin, y);
      y += t.length * 11 + 6;
    }
    y += 8;
  }

  if (opts.checklist.otimizacao_sugestao_ia?.trim()) {
    newPageIfNeeded(60);
    doc.setFontSize(12);
    doc.text("Otimização", margin, y);
    y += 16;
    doc.setFontSize(9);
    const o = doc.splitTextToSize(opts.checklist.otimizacao_sugestao_ia, maxW);
    newPageIfNeeded(o.length * 12);
    doc.text(o, margin, y);
    y += o.length * 12 + 12;
  }

  newPageIfNeeded(40);
  doc.setFontSize(12);
  doc.text("Checklist — inconformidades e revisões", margin, y);
  y += 16;
  doc.setFontSize(9);
  const problemas = opts.checklist.itens.filter((i) => i.status !== "conforme");
  if (problemas.length === 0) {
    doc.text("Nenhum item listado como inconforme ou revisar.", margin, y);
  } else {
    for (const i of problemas) {
      const t = doc.splitTextToSize(`[${i.status}] ${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`, maxW);
      newPageIfNeeded(t.length * 12 + 4);
      doc.text(t, margin, y);
      y += t.length * 12 + 4;
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Pré-análise automatizada — não substitui parecer oficial da PMC/SEPLAN nem estudo geotécnico.",
    margin,
    pageH - 28,
  );

  doc.save(`gabarito-pre-analise-${opts.zona}-${Date.now()}.pdf`);
}
