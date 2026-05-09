import type { StatusChecklist } from "@/types/gabarito";
import { jsPDF } from "jspdf";

export type RelatorioPdfOpts = {
  zona: string;
  nomeProjeto?: string;
  areaTerrenoM2?: number | null;
  areaConstruidaProjetoM2?: number | null;
  areaPermeavelPropostaM2?: number | null;
  usoEdificacao?: string | null;
  checklist: StatusChecklist;
  /** Texto completo persistido em `ultima_analise_ia` (parecer 70B + anexos). */
  ultimaAnaliseIa?: string | null;
};

function textoParecerCompletoParaPdf(opts: RelatorioPdfOpts): string | null {
  const u = opts.ultimaAnaliseIa?.trim();
  if (u) return u;
  const p = opts.checklist.parecer_tecnico_llama?.trim();
  const o = opts.checklist.otimizacao_sugestao_ia?.trim();
  if (!p && !o) return null;
  const parts: string[] = [];
  if (p) {
    parts.push("PARECER DO AUDITOR IA");
    parts.push("");
    parts.push(p);
  }
  if (o) {
    parts.push("");
    parts.push("SUGESTÃO DE OTIMIZAÇÃO");
    parts.push("");
    parts.push(o);
  }
  return parts.join("\n");
}

function safeText(s: unknown): string {
  if (typeof s !== "string") return "—";
  const t = s.trim();
  return t ? t : "—";
}

function fmtM2(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} m²`;
}

function regraLc751Literal(medida: string, regraOriginal: string): string {
  const base = `${medida} ${regraOriginal}`.toLowerCase();
  if (base.includes("taxa") && base.includes("ocup")) {
    return (
      'Taxa de Ocupação (Art. 21): "Relação percentual entre a projeção horizontal da área construída e da área escriturada do terreno." ' +
      "Nota de isenção: Não computar áreas descobertas, canis até 4m², abrigos de gás e lixeiras (Art. 21, § 1º)."
    );
  }
  if (base.includes("coef") || base.includes("ca") || base.includes("aproveitamento")) {
    return 'Coeficiente de Aproveitamento (Art. 20): "Determina a área que pode ser construída em um terreno e será obtida pela multiplicação do coeficiente definido para a zona pela área escriturada."';
  }
  if (base.includes("perme")) {
    return 'Área Permeável (Art. 22): "Todo terreno deverá possuir área permeável, revestida com vegetação, na proporção mínima de 20% da área escriturada."';
  }
  if (base.includes("recuo") && base.includes("frontal")) {
    return "Recuo Frontal (Art. 31): Medido a partir do alinhamento predial e das divisas do imóvel. Isenções: Canis até 4m², geradores, lixeiras, centrais de gás e guaritas até 6m² (Art. 31, § 1º).";
  }
  if (base.includes("recuo") && (base.includes("lateral") || base.includes("fundo"))) {
    return 'Recuo Lateral e de Fundos (Art. 35): "Calculado utilizando-se H/6 (altura da edificação sobre seis)."';
  }
  if (base.includes("muro")) {
    return "Muros (Art. 30): Altura máxima de 3,50m a partir do nível do solo.";
  }
  if (base.includes("janela") || base.includes("abertura") || base.includes("sacada") || base.includes("varanda")) {
    return 'Aberturas e Janelas (Art. 35-A): "É proibido aberturas como janelas, terraços, sacadas ou varandas, a menos de metro e meio (1,50m) do terreno vizinho."';
  }
  if (base.includes("parede cega") || base.includes("divisa")) {
    return "Paredes Cegas (Art. 25, § 3º): Construções nas divisas laterais e fundos com parede cega (sem aberturas) devem respeitar a altura máxima de 11m, podendo a cumeeira chegar a 15m.";
  }
  return regraOriginal;
}

function toPdfStatus(status: string): "Aprovado" | "Pendente" | "Crítico" {
  const s = status.trim().toLowerCase();
  if (s === "conforme") return "Aprovado";
  if (s === "inconforme" || s === "critico" || s === "crítico") return "Crítico";
  return "Pendente";
}

function toTemEFalta(itens: StatusChecklist["itens"] | undefined) {
  const list = itens ?? [];
  const tem = list.filter((i) => i.status === "conforme");
  const falta = list.filter((i) => i.status !== "conforme");
  return { tem, falta };
}

type CategoriaChecklistPdf = "recuos" | "to" | "permeabilidade" | "art41" | "potencial" | "outros";

function classificarCategoriaPdf(rotulo: string, detalhe?: string): CategoriaChecklistPdf {
  const t = `${rotulo} ${detalhe ?? ""}`.toLowerCase();
  if (t.includes("art. 41") || t.includes("arco") || t.includes("apr") || t.includes("enchente") || t.includes("cota 12")) {
    return "art41";
  }
  if (t.includes("recuo") || t.includes("frontal") || t.includes("lateral") || t.includes("fundo")) return "recuos";
  if (t.includes("taxa de ocup") || t.includes("to")) return "to";
  if (t.includes("perme")) return "permeabilidade";
  if (t.includes("coeficiente") || t.includes("ca") || t.includes("potencial") || t.includes("vgv")) return "potencial";
  return "outros";
}

/** Relatório (pré-análise) com cabeçalho “Gabarito”, dados do terreno/zona e matriz de conformidade. */
export function downloadRelatorioPdf(opts: RelatorioPdfOpts): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const maxW = pageW - margin * 2;
  let y = 46;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - 56) {
      doc.addPage();
      y = 46;
    }
  };

  // Cabeçalho (logo textual)
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Gabarito", margin, y);
  doc.setFont("helvetica", "normal");
  y += 22;

  doc.setFontSize(10);
  doc.text(`Projeto: ${safeText(opts.nomeProjeto)}`, margin, y);
  y += 14;
  doc.text(`Zona urbanística: ${safeText(opts.zona)}`, margin, y);
  y += 14;

  const areaTerreno = opts.checklist.entrada?.area_terreno_m2 ?? opts.areaTerrenoM2 ?? null;
  doc.text(`Área do terreno (m²): ${areaTerreno != null ? String(areaTerreno) : "—"}`, margin, y);
  y += 14;
  doc.text(`Área construída informada (m²): ${fmtM2(opts.areaConstruidaProjetoM2)}`, margin, y);
  y += 14;
  doc.text(`Área permeável proposta (m²): ${fmtM2(opts.areaPermeavelPropostaM2)}`, margin, y);
  y += 14;
  doc.text(`Uso da edificação: ${safeText(opts.usoEdificacao ?? "—")}`, margin, y);
  y += 14;
  doc.text(`Emitido: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 18;

  // Matriz 3 colunas
  const matriz = opts.checklist.matriz_conformidade ?? [];
  newPageIfNeeded(40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Matriz de Conformidade", margin, y);
  doc.setFont("helvetica", "normal");
  y += 16;

  // Cabeçalho da tabela
  const col1 = Math.floor(maxW * 0.42);
  const col2 = Math.floor(maxW * 0.43);
  const col3 = maxW - col1 - col2;
  const x1 = margin;
  const x2 = margin + col1;
  const x3 = margin + col1 + col2;

  const rowH = 16;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Medida", x1 + 2, y);
  doc.text("Regra (LC 751/2010)", x2 + 2, y);
  doc.text("Status", x3 + 2, y);
  doc.setFont("helvetica", "normal");
  y += 10;
  doc.line(margin, y, margin + maxW, y);
  y += 10;

  // Legenda de status (espelha semântica visual do dashboard).
  newPageIfNeeded(18);
  doc.setFontSize(8);
  doc.setFillColor(236, 253, 245); // verde claro
  doc.rect(margin, y - 7, 9, 9, "F");
  doc.setTextColor(22, 101, 52);
  doc.text("Aprovado", margin + 13, y);
  doc.setFillColor(255, 251, 235); // amarelo claro
  doc.rect(margin + 70, y - 7, 9, 9, "F");
  doc.setTextColor(146, 64, 14);
  doc.text("Pendente", margin + 83, y);
  doc.setFillColor(254, 242, 242); // vermelho claro
  doc.rect(margin + 145, y - 7, 9, 9, "F");
  doc.setTextColor(153, 27, 27);
  doc.text("Crítico", margin + 158, y);
  doc.setTextColor(0, 0, 0);
  y += 14;

  if (matriz.length === 0) {
    doc.setFontSize(9);
    doc.text("Matriz não informada pela IA.", margin, y);
    y += 14;
  } else {
    for (const r of matriz) {
      const c1 = doc.splitTextToSize(r.medida_identificada, col1 - 6);
      const c2 = doc.splitTextToSize(regraLc751Literal(r.medida_identificada, r.regra_lc751), col2 - 6);
      const status = toPdfStatus(r.status_conformidade);
      const c3 = doc.splitTextToSize(status, col3 - 6);
      const lines = Math.max(c1.length, c2.length, c3.length);
      const needed = lines * rowH + 6;
      newPageIfNeeded(needed);
      doc.setFontSize(8);
      doc.text(c1, x1 + 2, y);
      doc.text(c2, x2 + 2, y);
      if (status === "Aprovado") doc.setTextColor(22, 101, 52);
      if (status === "Pendente") doc.setTextColor(146, 64, 14);
      if (status === "Crítico") doc.setTextColor(153, 27, 27);
      doc.text(c3, x3 + 2, y);
      doc.setTextColor(0, 0, 0);
      y += lines * rowH + 4;
      doc.setDrawColor(220);
      doc.line(margin, y, margin + maxW, y);
      doc.setDrawColor(0);
      y += 8;
    }
  }

  const resumo = toTemEFalta(opts.checklist.itens);
  newPageIfNeeded(56);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Checklist da Planta — Tem vs Falta", margin, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  doc.setFontSize(9);
  doc.text(`Tem: ${resumo.tem.length} item(ns)`, margin, y);
  y += 14;
  if (resumo.tem.length > 0) {
    for (const i of resumo.tem.slice(0, 8)) {
      const t = doc.splitTextToSize(`• ${i.rotulo}`, maxW);
      newPageIfNeeded(t.length * 12 + 2);
      doc.text(t, margin, y);
      y += t.length * 12 + 2;
    }
  }
  y += 8;
  doc.text(`Falta: ${resumo.falta.length} item(ns)`, margin, y);
  y += 14;
  if (resumo.falta.length > 0) {
    for (const i of resumo.falta.slice(0, 8)) {
      const t = doc.splitTextToSize(`• ${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`, maxW);
      newPageIfNeeded(t.length * 12 + 2);
      doc.text(t, margin, y);
      y += t.length * 12 + 2;
    }
  }
  y += 10;

  const labels: Record<CategoriaChecklistPdf, string> = {
    recuos: "Recuos",
    to: "Taxa de Ocupação",
    permeabilidade: "Permeabilidade",
    art41: "Art. 41 / ARCO",
    potencial: "Potencial / CA",
    outros: "Outros",
  };
  const buckets: Record<CategoriaChecklistPdf, number> = {
    recuos: 0,
    to: 0,
    permeabilidade: 0,
    art41: 0,
    potencial: 0,
    outros: 0,
  };
  for (const item of resumo.falta) {
    buckets[classificarCategoriaPdf(item.rotulo, item.detalhe)] += 1;
  }

  newPageIfNeeded(64);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Falta por categoria", margin, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  doc.setFontSize(9);
  for (const key of Object.keys(labels) as CategoriaChecklistPdf[]) {
    const line = `${labels[key]}: ${buckets[key]} item(ns)`;
    newPageIfNeeded(14);
    doc.text(`• ${line}`, margin, y);
    y += 12;
  }

  const parecerCompleto = textoParecerCompletoParaPdf(opts);
  if (parecerCompleto) {
    y += 10;
    newPageIfNeeded(48);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Parecer do Auditor IA (texto integral gravado)", margin, y);
    doc.setFont("helvetica", "normal");
    y += 16;
    doc.setFontSize(8.5);
    const parecerLines = doc.splitTextToSize(parecerCompleto, maxW);
    for (const line of parecerLines) {
      newPageIfNeeded(14);
      doc.text(line, margin, y);
      y += 12;
    }
    y += 8;
  }

  // Rodapé legal (fixo no fim da página atual)
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const footer =
    "Esta é uma pré-análise automatizada baseada na LC 751/2010 e não substitui a consulta oficial à SEPLAN/Blumenau";
  const fLines = doc.splitTextToSize(footer, maxW);
  doc.text(fLines, margin, pageH - 36);
  doc.setTextColor(0, 0, 0);

  doc.save(`gabarito-relatorio-${Date.now()}.pdf`);
}

