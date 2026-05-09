import type { StatusChecklist } from "@/types/gabarito";
import { jsPDF } from "jspdf";

export type RelatorioOficialLc751Opts = {
  projetoId: string;
  nomeProjeto: string;
  zona: string;
  areaTerrenoM2: number | null;
  areaRestantePotencialM2: number | null;
  checklist: StatusChecklist;
  ultimaAnaliseIa?: string | null;
};

const LC751_NOTAS = [
  "Lei Complementar nº 751, de 15 de julho de 2010 (Blumenau/SC) — quadro urbanístico e parâmetros de zoneamento.",
  "Art. 22 — áreas permeáveis mínimas e critérios de permeabilidade do lote (conferir fração exigida para a zona).",
  "Art. 35 — recuos obrigatórios (frontal, lateral e de fundo, conforme o caso) e afastamentos da edificação em relação aos limites do terreno.",
  "Arts. 13 e 20 — coeficiente de aproveitamento e potencial construtivo indicativo (área construída máxima em função do terreno e do CA da zona).",
];

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

/** Relatório sintético alinhado ao snapshot gravado em `projetos`, com remissões à LC 751/2010. */
export function downloadRelatorioOficialLc751Pdf(opts: RelatorioOficialLc751Opts): void {
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
  doc.text("Gabarito — relatório oficial (LC 751/2010)", margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Registro da análise: ${opts.projetoId}`, margin, y);
  y += 14;
  doc.text(`Projeto: ${opts.nomeProjeto.trim() || "—"}  |  Zona: ${opts.zona}`, margin, y);
  y += 14;
  doc.text(`Emitido: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 22;

  doc.setFontSize(11);
  doc.text("1. Fundamentação normativa (referências)", margin, y);
  y += 16;
  doc.setFontSize(9);
  for (const line of LC751_NOTAS) {
    const block = doc.splitTextToSize(`• ${line}`, maxW);
    newPageIfNeeded(block.length * 12 + 6);
    doc.text(block, margin, y);
    y += block.length * 12 + 6;
  }
  y += 10;

  newPageIfNeeded(80);
  doc.setFontSize(11);
  doc.text("2. Dados da análise gravada", margin, y);
  y += 16;
  doc.setFontSize(9);
  const entrada = opts.checklist.entrada?.area_terreno_m2 ?? opts.areaTerrenoM2;
  const ar =
    opts.areaRestantePotencialM2 ??
    opts.checklist.area_restante_potencial_m2 ??
    null;
  const linhasDados = [
    `Área do terreno (entrada): ${entrada != null && Number.isFinite(entrada) ? `${entrada} m²` : "—"}`,
    `Área restante (potencial não utilizado, limite CA − estimativa IA): ${
      ar != null && Number.isFinite(ar) ? `${ar} m²` : "— (estimativa de área construída indisponível)"
    }`,
  ];
  for (const line of linhasDados) {
    newPageIfNeeded(18);
    doc.text(line, margin, y);
    y += 14;
  }
  y += 12;

  const m = opts.checklist.metricas_servidor;
  if (m) {
    newPageIfNeeded(90);
    doc.setFontSize(11);
    doc.text("3. Parâmetros calculados no servidor (LC 751 / quadro da zona)", margin, y);
    y += 16;
    doc.setFontSize(9);
    const ml = [
      `Área máxima construída indicativa (terreno × CA): ${m.area_maxima_construida_m2.toFixed(2)} m²`,
      `Projeção máxima (taxa de ocupação): ${m.area_projecao_maxima_m2.toFixed(2)} m²`,
      `Área permeável necessária mínima (Art. 22 — fração da zona): ${m.area_permeavel_necessaria_m2.toFixed(2)} m²`,
    ];
    for (const line of ml) {
      newPageIfNeeded(16);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 10;
  }

  if (opts.checklist.potencial) {
    newPageIfNeeded(72);
    doc.setFontSize(11);
    doc.text("4. Potencial construtivo (Arts. 13/20 — indicativo)", margin, y);
    y += 16;
    doc.setFontSize(9);
    const p = opts.checklist.potencial;
    const pl = [
      `Limite de área construída: ${p.limite_area_construida_m2.toFixed(1)} m²`,
      p.area_construida_estimada_ia_m2 != null
        ? `Estimativa pela IA: ${p.area_construida_estimada_ia_m2.toFixed(1)} m²`
        : "Estimativa pela IA: não informada",
      `Situação: ${p.status} — ${p.nota_tecnica}`,
    ];
    for (const line of pl) {
      newPageIfNeeded(16);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 10;
  }

  if (opts.checklist.matriz_conformidade?.length) {
    newPageIfNeeded(36);
    doc.setFontSize(11);
    doc.text("5. Matriz de conformidade (medida × regra × status)", margin, y);
    y += 16;
    doc.setFontSize(8);
    for (const row of opts.checklist.matriz_conformidade) {
      const t = doc.splitTextToSize(
        `• ${row.medida_identificada} | ${regraLc751Literal(row.medida_identificada, row.regra_lc751)} | ${row.status_conformidade}`,
        maxW,
      );
      newPageIfNeeded(t.length * 11 + 6);
      doc.text(t, margin, y);
      y += t.length * 11 + 6;
    }
    y += 8;
  }

  newPageIfNeeded(36);
  doc.setFontSize(11);
  doc.text("6. Checklist — acertos e pendências", margin, y);
  y += 16;
  doc.setFontSize(9);
  const conformes = opts.checklist.itens.filter((i) => i.status === "conforme");
  const outros = opts.checklist.itens.filter((i) => i.status !== "conforme");
  doc.setFont("helvetica", "bold");
  doc.text(`Conformes (${conformes.length})`, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  for (const i of conformes) {
    const t = doc.splitTextToSize(`✓ ${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`, maxW);
    newPageIfNeeded(t.length * 12 + 4);
    doc.text(t, margin, y);
    y += t.length * 12 + 4;
  }
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Inconformes / revisar (${outros.length})`, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  if (outros.length === 0) {
    doc.text("Nenhum item nesta categoria.", margin, y);
    y += 14;
  } else {
    for (const i of outros) {
      const t = doc.splitTextToSize(`[${i.status}] ${i.rotulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`, maxW);
      newPageIfNeeded(t.length * 12 + 4);
      doc.text(t, margin, y);
      y += t.length * 12 + 4;
    }
  }

  let parecerDb = opts.ultimaAnaliseIa?.trim();
  if (!parecerDb) {
    const p = opts.checklist.parecer_tecnico_llama?.trim();
    const o = opts.checklist.otimizacao_sugestao_ia?.trim();
    if (p || o) {
      const parts: string[] = [];
      if (p) {
        parts.push("PARECER DO AUDITOR IA", "", p);
      }
      if (o) {
        parts.push("", "SUGESTÃO DE OTIMIZAÇÃO", "", o);
      }
      parecerDb = parts.join("\n");
    }
  }
  if (parecerDb) {
    y += 18;
    newPageIfNeeded(48);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("7. Parecer do Auditor IA (ultima_analise_ia)", margin, y);
    doc.setFont("helvetica", "normal");
    y += 16;
    doc.setFontSize(8.5);
    for (const line of doc.splitTextToSize(parecerDb, maxW)) {
      newPageIfNeeded(14);
      doc.text(line, margin, y);
      y += 12;
    }
    y += 8;
  }

  y += 16;
  newPageIfNeeded(40);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const aviso = doc.splitTextToSize(
    "Este relatório reproduz o resultado automatizado da análise por visão computacional e dos parâmetros cadastrados para a zona. Não substitui parecer técnico municipal, memorial de cálculo assinado ou a legislação consolidada.",
    maxW,
  );
  doc.text(aviso, margin, y);
  doc.setTextColor(0, 0, 0);

  doc.save(`gabarito-relatorio-oficial-lc751-${opts.projetoId.slice(0, 8)}.pdf`);
}
