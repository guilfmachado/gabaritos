"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { areaPermeavelParaPercentual, taxaOcupacaoParaPercentual } from "@/lib/gabarito/taxa-ocupacao";
import { cn } from "@/lib/utils";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";
import { ConsultorIADrawer } from "@/components/gabarito/consultor-ia-drawer";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPinned,
  MessageCircle,
  ScrollText,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const NOME_PLATAFORMA = "Gabarito";
const HORAS_ECONOMIZADAS_POR_ANALISE = 14;
const GEO_BLUMENAU_URL = "https://geo.blumenau.sc.gov.br";

/** Inciso I, Art. 41, LC 751/2010 — texto para banner de governança (pré-análise). */
const TEXTO_ART_41_I_LC751 =
  "Art. 41, I — É proibido o uso residencial abaixo da cota de enchente de 12,00 (doze) metros nos terrenos situados nas áreas classificadas como ARCO ou APR, nos termos desta lei complementar.";

function isZonaIndicativaRiscoCheia(z: string): boolean {
  const u = z.toUpperCase();
  return u.includes("APR") || u.includes("ARCO") || u.includes("COTA 12") || u.includes("COTA12") || u.includes("12M");
}

function riscoReprovacaoLabel(checklist: StatusChecklist | null): { label: string; tone: "ok" | "warn" | "bad" } {
  if (!checklist?.itens?.length) {
    return { label: "—", tone: "ok" };
  }
  const inconformes = checklist.itens.filter((i) => i.status === "inconforme").length;
  const revisar = checklist.itens.filter((i) => i.status === "revisar").length;
  if (inconformes >= 2) return { label: "Alto", tone: "bad" };
  if (inconformes === 1 || revisar > 0) return { label: "Médio", tone: "warn" };
  return { label: "Baixo", tone: "ok" };
}

const riscoToneClass: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};

/** Gauge circular: aproveitamento do coeficiente (área construída / terreno × CA máx.). */
function CaGauge({ utilizacaoPct }: { utilizacaoPct: number }) {
  const pct = Math.min(100, Math.max(0, utilizacaoPct));
  const size = 120;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(226 232 240)" strokeWidth={stroke} className="transition-colors" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgb(5 150 105)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{pct.toFixed(0)}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">do CA</span>
      </div>
    </div>
  );
}

function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Evita mostrar JSON inteiro no parágrafo de resumo quando o parse falhou parcialmente. */
function looksLikeRawJsonDump(s: string): boolean {
  const t = s.trim();
  return t.startsWith("{") && t.length > 160 && /"itens"\s*:/.test(t);
}

function toUiStatusFinalBoss(status: string): "Aprovado" | "Pendente" | "Crítico" {
  const s = status.trim().toLowerCase();
  if (s === "conforme") return "Aprovado";
  if (s === "inconforme" || s === "critico" || s === "crítico") return "Crítico";
  return "Pendente";
}

function statusBadgeClass(status: "Aprovado" | "Pendente" | "Crítico"): string {
  if (status === "Aprovado") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Crítico") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function regraLc751Literal(medida: string, regraOriginal: string): string {
  const base = `${medida} ${regraOriginal}`.toLowerCase();
  if (base.includes("taxa") && base.includes("ocup")) {
    return 'Art. 21: Relação percentual entre a projeção horizontal da área construída e da área escriturada do terreno.';
  }
  if (base.includes("perme")) {
    return "Art. 22: Mínimo de 20% de área permeável revestida com vegetação.";
  }
  if (base.includes("recuo") && base.includes("frontal")) {
    return "Art. 31: Recuo frontal mínimo conforme zona (com isenções do §1º).";
  }
  if (base.includes("recuo") && (base.includes("lateral") || base.includes("fundo"))) {
    return "Art. 35: Recuo lateral/fundos calculado por H/6.";
  }
  if (base.includes("coef") || base.includes("ca") || base.includes("aproveitamento")) {
    return "Art. 20: Área construída permitida = coeficiente da zona × área escriturada do terreno.";
  }
  if (base.includes("35-a") || base.includes("35a") || base.includes("abertur") || base.includes("vão") || base.includes("vao")) {
    return "Art. 35-A: Afastamento mínimo de 1,50 m para vãos de portas e janelas em relação ao alinhamento frontal e aos recuos obrigatórios.";
  }
  return regraOriginal;
}

function checklistResumo(itens: StatusChecklist["itens"] | undefined) {
  const list = itens ?? [];
  const tem = list.filter((i) => i.status === "conforme");
  const pendente = list.filter((i) => i.status === "revisar");
  const critico = list.filter((i) => i.status === "inconforme");
  const falta = [...critico, ...pendente];
  return { tem, falta, pendente, critico, total: list.length };
}

type CategoriaChecklist = "todas" | "recuos" | "to" | "permeabilidade" | "art41" | "potencial" | "outros";

function classificarCategoria(rotulo: string, detalhe?: string): Exclude<CategoriaChecklist, "todas"> {
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

function seloGovernanca(checklist: StatusChecklist | null): "Conforme" | "Atenção" | "Bloqueio de Ocupação" {
  if (!checklist) return "Atenção";
  if (checklist.alertas_criticos?.some((a) => a.codigo === "BLOQUEIO_OCUPACAO")) return "Bloqueio de Ocupação";
  if (checklist.itens?.some((i) => i.status !== "conforme")) return "Atenção";
  return "Conforme";
}

function IaSugestaoBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
      title="Valor sugerido pela leitura da planta (Llama Vision)"
    >
      <Sparkles className="size-3 shrink-0" aria-hidden />
      IA
    </span>
  );
}

type AnalyzeResponse = {
  checklist: StatusChecklist;
  rawOutput: string;
  resultado_ia?: string;
  norma: NormaLocal;
  ultima_analise_ia?: string;
  projeto_id?: string;
  imagem_utilizada?: string;
  area_terreno_m2?: number;
  area_restante_potencial_m2?: number | null;
  imagem_planta_url?: string | null;
  persistError?: string;
};

export function GabaritoDashboard() {
  const [normas, setNormas] = useState<NormaLocal[]>([]);
  const [zona, setZona] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/png");
  const [base64, setBase64] = useState<string | null>(null);
  const [loadingNormas, setLoadingNormas] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [inscricao, setInscricao] = useState("");
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [creatingProj, setCreatingProj] = useState(false);
  const [urlPlanta, setUrlPlanta] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** Área do terreno (m²) para limite construtivo indicativo (× CA). */
  const [areaTerrenoM2Input, setAreaTerrenoM2Input] = useState("");
  const [areaConstruidaProjetoInput, setAreaConstruidaProjetoInput] = useState("");
  const [areaPermeavelPropostaInput, setAreaPermeavelPropostaInput] = useState("");
  const [usoImovelInput, setUsoImovelInput] = useState("Residencial");
  const [restricaoUsoSoloInput, setRestricaoUsoSoloInput] = useState("nao_informado");
  const [isTombadoInput, setIsTombadoInput] = useState(false);
  const [categoriaChecklist, setCategoriaChecklist] = useState<CategoriaChecklist>("todas");
  const [analisesHistoricoCount, setAnalisesHistoricoCount] = useState(0);
  const [showModalOtimizar, setShowModalOtimizar] = useState(false);
  const [otimizacaoIaText, setOtimizacaoIaText] = useState<string | null>(null);
  const [otimizacaoIaLoading, setOtimizacaoIaLoading] = useState(false);
  const [otimizacaoIaError, setOtimizacaoIaError] = useState<string | null>(null);
  const [iaSugerido, setIaSugerido] = useState({ terreno: false, construida: false, permeavel: false });
  const [reauditLoading, setReauditLoading] = useState(false);
  const [consultorOpen, setConsultorOpen] = useState(false);
  const [art41BannerDismissed, setArt41BannerDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfConversionSeq = useRef(0);

  const applyExtracaoToSmartEntry = useCallback((checklist: StatusChecklist | null | undefined) => {
    const ex = checklist?.extracao_visao;
    if (!ex) return;
    const total = ex.area_construida_total_m2 ?? ex.area_construida_estimada_m2;
    if (total != null && Number.isFinite(total) && total > 0) {
      setAreaConstruidaProjetoInput(String(Math.round(total * 100) / 100));
      setIaSugerido((s) => ({ ...s, construida: true }));
    }
    if (ex.area_permeavel_estimada_m2 != null && Number.isFinite(ex.area_permeavel_estimada_m2) && ex.area_permeavel_estimada_m2 >= 0) {
      setAreaPermeavelPropostaInput(String(Math.round(ex.area_permeavel_estimada_m2 * 100) / 100));
      setIaSugerido((s) => ({ ...s, permeavel: true }));
    }
  }, []);

  const refreshHistorico = useCallback(async () => {
    try {
      const res = await fetch("/api/projetos");
      const data = (await res.json()) as { projetos?: unknown[] };
      setAnalisesHistoricoCount(Array.isArray(data.projetos) ? data.projetos.length : 0);
    } catch {
      setAnalisesHistoricoCount(0);
    }
  }, []);

  const areaDashNum = Number(areaTerrenoM2Input.trim().replace(",", "."));
  const areaDashOk = Number.isFinite(areaDashNum) && areaDashNum > 0;
  const podeAnalisarImagem = Boolean(base64 && zona && areaDashOk);
  const analiseConcluida = Boolean(result);
  const nomeExibicao = nomeProjeto.trim() || NOME_PLATAFORMA;
  const alertaArt41 = result?.checklist?.alertas_criticos?.find((a) => a.codigo === "BLOQUEIO_OCUPACAO");
  const selo = seloGovernanca(result?.checklist ?? null);
  const totalAnalises = analisesHistoricoCount;
  const riscoCheiaNaAnalise = Boolean(
    result?.checklist?.inferencia_cota_enchente_12m === true || result?.checklist?.inferencia_area_potencial_risco === true,
  );
  const mostrarBannerFlutuanteArt41 =
    usoImovelInput === "Residencial" &&
    (isZonaIndicativaRiscoCheia(zona) || riscoCheiaNaAnalise || Boolean(alertaArt41));
  const exibirBannerArt41 = mostrarBannerFlutuanteArt41 && !art41BannerDismissed;
  const resumoChecklist = checklistResumo(result?.checklist?.itens);
  const temFiltrado =
    categoriaChecklist === "todas"
      ? resumoChecklist.tem
      : resumoChecklist.tem.filter((i) => classificarCategoria(i.rotulo, i.detalhe) === categoriaChecklist);
  const faltaFiltrado =
    categoriaChecklist === "todas"
      ? resumoChecklist.falta
      : resumoChecklist.falta.filter((i) => classificarCategoria(i.rotulo, i.detalhe) === categoriaChecklist);
  const areaTerrenoNum = Number(areaTerrenoM2Input.trim().replace(",", "."));
  const areaConstruidaInformadaNum = Number(areaConstruidaProjetoInput.trim().replace(",", "."));
  const areaPermeavelPropostaNum = Number(areaPermeavelPropostaInput.trim().replace(",", "."));
  const limitePotencial =
    result?.checklist?.potencial?.limite_area_construida_m2 ??
    (Number.isFinite(areaTerrenoNum) && result?.norma ? areaTerrenoNum * result.norma.indice_aproveitamento_max : null);
  const areaUsada =
    Number.isFinite(areaConstruidaInformadaNum) && areaConstruidaInformadaNum > 0
      ? areaConstruidaInformadaNum
      : (result?.checklist?.area_construida_estimada_ia_m2 ?? null);
  const potencialRestante =
    limitePotencial != null && areaUsada != null ? Math.max(0, limitePotencial - areaUsada) : null;
  const ratioPotencial =
    limitePotencial != null && limitePotencial > 0 && areaUsada != null ? Math.min(100, Math.max(0, (areaUsada / limitePotencial) * 100)) : 0;
  const permeavelMinima =
    Number.isFinite(areaTerrenoNum) && result?.norma
      ? areaTerrenoNum * (areaPermeavelParaPercentual(result.norma.taxa_permeabilidade_min) / 100)
      : null;
  const permeavelOk =
    permeavelMinima != null && Number.isFinite(areaPermeavelPropostaNum) ? areaPermeavelPropostaNum >= permeavelMinima : null;
  const riscoReprov = riscoReprovacaoLabel(result?.checklist ?? null);
  const mostrarCaGauge = limitePotencial != null && limitePotencial > 0 && areaUsada != null;

  const consultorFormContext = useMemo(
    () => ({
      zona_urbanistica: zona,
      area_terreno_m2: Number.isFinite(areaTerrenoNum) && areaTerrenoNum > 0 ? areaTerrenoNum : null,
      area_construida_m2:
        Number.isFinite(areaConstruidaInformadaNum) && areaConstruidaInformadaNum > 0 ? areaConstruidaInformadaNum : null,
      area_permeavel_m2:
        areaPermeavelPropostaInput.trim() && Number.isFinite(areaPermeavelPropostaNum) && areaPermeavelPropostaNum >= 0
          ? areaPermeavelPropostaNum
          : null,
      uso_imovel: usoImovelInput.trim(),
      restricao_uso_solo: restricaoUsoSoloInput,
      is_tombado: isTombadoInput,
      nome_projeto: nomeExibicao,
    }),
    [
      areaConstruidaInformadaNum,
      areaPermeavelPropostaInput,
      areaPermeavelPropostaNum,
      areaTerrenoNum,
      isTombadoInput,
      nomeExibicao,
      restricaoUsoSoloInput,
      usoImovelInput,
      zona,
    ],
  );

  const fallbackTextoOtimizacao = useCallback(() => {
    if (potencialRestante != null && potencialRestante > 0 && limitePotencial != null && areaUsada != null) {
      return (
        `Área indicativa ainda disponível: ~${potencialRestante.toFixed(1)} m² (limite ~${limitePotencial.toFixed(1)} m² menos ~${areaUsada.toFixed(1)} m² construídos). ` +
        "Avalie ampliação por pavimentos ou compartimentos respeitando TO, recuos e permeabilidade. " +
        "Para novas aberturas, observe o Art. 35-A da LC 751/2010: afastamento mínimo de 1,50 m para vãos de portas e janelas em relação ao alinhamento frontal e aos recuos obrigatórios."
      );
    }
    return "Sem margem indicativa com os dados atuais ou análise incompleta. Confira memorial, quadro de áreas e parâmetros da zona na SEPLAN.";
  }, [potencialRestante, limitePotencial, areaUsada]);

  const abrirOtimizacaoLlama = useCallback(async () => {
    setOtimizacaoIaError(null);
    setOtimizacaoIaText(null);
    setOtimizacaoIaLoading(true);
    setShowModalOtimizar(true);
    const at = Number.isFinite(areaTerrenoNum) ? areaTerrenoNum : null;
    if (at == null || at <= 0) {
      setOtimizacaoIaError("Informe a área do terreno.");
      setOtimizacaoIaText(fallbackTextoOtimizacao());
      setOtimizacaoIaLoading(false);
      return;
    }
    const caMax = result?.norma?.indice_aproveitamento_max ?? null;
    const lim = limitePotencial;
    const ac = areaUsada;
    const matrizItens =
      result?.checklist?.matriz_conformidade?.map((row) => ({
        medida: row.medida_identificada,
        status: row.status_conformidade,
      })) ?? [];
    try {
      const res = await fetch("/api/insights/otimizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zona_urbanistica: zona,
          uso_imovel: usoImovelInput,
          restricao_uso_solo: restricaoUsoSoloInput,
          is_tombado: isTombadoInput,
          area_terreno_m2: at,
          area_construida_m2: ac,
          area_permeavel_m2:
            areaPermeavelPropostaInput.trim() && Number.isFinite(areaPermeavelPropostaNum) && areaPermeavelPropostaNum >= 0
              ? areaPermeavelPropostaNum
              : null,
          limite_area_construida_m2: lim,
          coeficiente_aproveitamento_max: caMax,
          matriz_itens: matrizItens,
        }),
      });
      const data = (await res.json()) as { texto?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar sugestão.");
      const t = data.texto?.trim();
      if (t) setOtimizacaoIaText(t);
      else throw new Error("Resposta vazia.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido.";
      setOtimizacaoIaError(msg);
      setOtimizacaoIaText(fallbackTextoOtimizacao());
    } finally {
      setOtimizacaoIaLoading(false);
    }
  }, [
    areaPermeavelPropostaInput,
    areaPermeavelPropostaNum,
    areaTerrenoNum,
    areaUsada,
    fallbackTextoOtimizacao,
    isTombadoInput,
    limitePotencial,
    restricaoUsoSoloInput,
    result?.checklist?.matriz_conformidade,
    result?.norma?.indice_aproveitamento_max,
    usoImovelInput,
    zona,
  ]);

  const runReauditComValoresAtuais = useCallback(async () => {
    if (!result?.checklist?.extracao_visao) {
      setError("Execute antes a análise por visão para obter a extração da planta.");
      return;
    }
    const at = Number(areaTerrenoM2Input.trim().replace(",", "."));
    if (!Number.isFinite(at) || at <= 0) {
      setError("Informe a área do terreno em m².");
      return;
    }
    const ac = Number(areaConstruidaProjetoInput.trim().replace(",", "."));
    const ap = Number(areaPermeavelPropostaInput.trim().replace(",", "."));
    setReauditLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zona_urbanistica: zona,
          area_terreno_m2: at,
          area_construida_m2: Number.isFinite(ac) && ac > 0 ? ac : null,
          area_permeavel_m2: areaPermeavelPropostaInput.trim() && Number.isFinite(ap) && ap >= 0 ? ap : null,
          uso_imovel: usoImovelInput.trim() || null,
          restricao_uso_solo: restricaoUsoSoloInput,
          is_tombado: isTombadoInput,
          extracao_visao: result.checklist.extracao_visao,
        }),
      });
      const data = (await res.json()) as { checklist?: StatusChecklist; ultima_analise_ia?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha na reauditoria.");
      if (!data.checklist) throw new Error("Resposta sem checklist.");
      setResult((prev) =>
        prev
          ? {
              ...prev,
              checklist: data.checklist as StatusChecklist,
              ultima_analise_ia: data.ultima_analise_ia ?? prev.ultima_analise_ia,
            }
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na reauditoria.");
    } finally {
      setReauditLoading(false);
    }
  }, [
    areaConstruidaProjetoInput,
    areaPermeavelPropostaInput,
    areaTerrenoM2Input,
    isTombadoInput,
    result?.checklist?.extracao_visao,
    restricaoUsoSoloInput,
    usoImovelInput,
    zona,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/normas");
        const data = (await res.json()) as {
          normas?: NormaLocal[];
          error?: string;
          supabase?: { code?: string; details?: string; hint?: string };
          table?: string;
        };
        if (!res.ok) {
          console.error("Detalhe do erro do Supabase:", data);
          const detail =
            data.supabase?.hint || data.supabase?.details || data.supabase?.code
              ? ` [${[data.supabase?.code, data.supabase?.details, data.supabase?.hint].filter(Boolean).join(" | ")}]`
              : "";
          throw new Error((data.error ?? "Falha ao carregar zonas.") + detail);
        }
        const list = (data.normas ?? []) as NormaLocal[];
        if (!cancelled) {
          setNormas(list);
          if (list[0]) setZona(list[0].zona_urbanistica);
        }
      } catch (e) {
        console.error("Detalhe do erro do Supabase:", e);
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar normas.");
      } finally {
        if (!cancelled) setLoadingNormas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshHistorico();
  }, [refreshHistorico]);

  useEffect(() => {
    setArt41BannerDismissed(false);
  }, [zona, usoImovelInput]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [pdfObjectUrl]);

  useEffect(() => {
    if (!analyzing) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [analyzing]);

  const clearPreview = useCallback(() => {
    pdfConversionSeq.current += 1;
    setConvertingPdf(false);
    setPreview(null);
    setBase64(null);
    setPdfObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const onFile = useCallback(
    (file: File | null) => {
      setError(null);
      setResult(null);
      if (!file) {
        clearPreview();
        return;
      }

      if (file.type === "application/pdf") {
        clearPreview();
        const url = URL.createObjectURL(file);
        setPdfObjectUrl(url);
        setBase64(null);
        setPreview(null);
        setConvertingPdf(true);
        const seq = ++pdfConversionSeq.current;
        void (async () => {
          try {
            const { convertPdfToImage } = await import("@/lib/pdf/convert-pdf-to-image");
            const dataUrl = await convertPdfToImage(file);
            if (seq !== pdfConversionSeq.current) return;
            const comma = dataUrl.indexOf(",");
            const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            setMimeType("image/jpeg");
            setPreview(dataUrl);
            setBase64(b64);
            setPdfObjectUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          } catch (e) {
            if (seq !== pdfConversionSeq.current) return;
            setError(e instanceof Error ? `Falha ao converter PDF: ${e.message}` : "Falha ao converter PDF.");
          } finally {
            if (seq === pdfConversionSeq.current) setConvertingPdf(false);
          }
        })();
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Use PNG, JPG ou PDF.");
        return;
      }

      setConvertingPdf(false);
      setPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        const comma = r.indexOf(",");
        const b64 = comma >= 0 ? r.slice(comma + 1) : r;
        setBase64(b64);
        setPreview(r);
      };
      reader.readAsDataURL(file);
    },
    [clearPreview],
  );

  const runAnalyze = async () => {
    if (!base64 || !zona) {
      setError("Selecione a zona e envie uma imagem (PNG ou JPG) para análise por IA.");
      return;
    }
    const areaParsed = Number(areaTerrenoM2Input.trim().replace(",", "."));
    const areaConstruidaProjetoParsed = Number(areaConstruidaProjetoInput.trim().replace(",", "."));
    const areaPermeavelPropostaParsed = Number(areaPermeavelPropostaInput.trim().replace(",", "."));
    if (!Number.isFinite(areaParsed) || areaParsed <= 0) {
      setError("Informe a área do terreno em m² (obrigatório).");
      return;
    }
    setIaSugerido({ terreno: false, construida: false, permeavel: false });
    setAnalyzing(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        imageBase64: base64,
        mimeType,
        zona_urbanistica: zona,
        area_terreno: areaParsed,
        area_construida_projeto:
          areaConstruidaProjetoInput.trim() && Number.isFinite(areaConstruidaProjetoParsed) && areaConstruidaProjetoParsed > 0
            ? areaConstruidaProjetoParsed
            : undefined,
        area_permeavel_proposta:
          areaPermeavelPropostaInput.trim() && Number.isFinite(areaPermeavelPropostaParsed) && areaPermeavelPropostaParsed >= 0
            ? areaPermeavelPropostaParsed
            : undefined,
        uso_imovel: usoImovelInput.trim() || undefined,
        restricao_uso_solo: restricaoUsoSoloInput,
        is_tombado: isTombadoInput,
        persist: true,
        nome_projeto: nomeExibicao,
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na análise.");
      const parsed = data as AnalyzeResponse;
      setResult(parsed);
      applyExtracaoToSmartEntry(parsed.checklist);
      if (parsed.persistError) {
        setError(`Análise concluída, mas falhou ao salvar no banco: ${parsed.persistError}`);
      }
      void refreshHistorico();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const criarProjeto = async () => {
    if (!zona) {
      setError("Selecione a zona.");
      return;
    }
    setCreatingProj(true);
    setError(null);
    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zona_urbanistica: zona,
          nome: nomeProjeto?.trim() || undefined,
          inscricao_imobiliaria: inscricao || undefined,
          imagem_planta_url: urlPlanta.trim() || undefined,
          planta_url: urlPlanta.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o projeto.");
      setProjetoId(data.id as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar projeto.");
    } finally {
      setCreatingProj(false);
    }
  };

  const salvarUrlProjeto = async () => {
    if (!projetoId || !urlPlanta.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${projetoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagem_planta_url: urlPlanta.trim(),
          planta_url: urlPlanta.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar URL.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar URL.");
    } finally {
      setAnalyzing(false);
    }
  };

  const runAnalyzePorProjeto = async () => {
    if (!projetoId) {
      setError("Crie o projeto (avançado) antes da análise por URL.");
      return;
    }
    setIaSugerido({ terreno: false, construida: false, permeavel: false });
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${projetoId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na análise por projeto.");
      const checklist = data.checklist as StatusChecklist;
      setResult({
        checklist,
        rawOutput: data.resultado_ia as string,
        resultado_ia: data.resultado_ia as string,
        norma: data.norma as NormaLocal,
        ultima_analise_ia: data.ultima_analise_ia as string | undefined,
        projeto_id: data.projeto_id as string,
        imagem_utilizada: data.imagem_utilizada as string,
        area_terreno_m2: data.area_terreno_m2 as number | undefined,
        area_restante_potencial_m2: data.area_restante_potencial_m2 as number | null | undefined,
      });
      applyExtracaoToSmartEntry(checklist);
      void refreshHistorico();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <>
      {exibirBannerArt41 ? (
        <div
          role="alert"
          className="fixed left-1/2 top-3 z-[60] w-[min(56rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-red-200 bg-red-50/95 py-3 pl-4 pr-11 shadow-lg shadow-red-900/10 backdrop-blur-md transition-all duration-300 ease-out md:pl-5 md:pr-12"
        >
          <button
            type="button"
            onClick={() => setArt41BannerDismissed(true)}
            className="absolute right-2 top-2 rounded-lg p-1.5 text-red-800/90 transition hover:bg-red-100 hover:text-red-950"
            aria-label="Fechar alerta Art. 41"
          >
            <X className="size-4" aria-hidden />
          </button>
          <h2 className="flex items-center gap-2 pr-1 text-sm font-semibold tracking-tight text-red-900">
            <AlertTriangle className="size-4 shrink-0 text-red-700" aria-hidden />
            Alerta Art. 41, I — uso residencial e risco de cheias (LC 751/2010)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-red-950/95">{TEXTO_ART_41_I_LC751}</p>
          {alertaArt41 ? (
            <p className="mt-2 text-xs leading-relaxed text-red-900/85">{alertaArt41.mensagem}</p>
          ) : (
            <p className="mt-2 text-xs text-red-800/90">
              Zona ou sinais na análise indicam atenção à cota 12 m / APR ou ARCO. Confirme sempre na SEPLAN/Blumenau.
            </p>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "relative mx-auto max-w-[1600px] space-y-6 px-1 lg:px-0",
          exibirBannerArt41 && "pt-24 lg:pt-28",
        )}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md md:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={nomeProjeto}
                onChange={(e) => setNomeProjeto(e.target.value)}
                placeholder="Nome do projeto"
                aria-label="Nome do projeto"
                className="h-9 max-w-full border-slate-200 text-sm font-medium text-slate-900 sm:max-w-xs lg:max-w-[14rem]"
              />
              <div className="min-w-0 lg:border-l lg:border-slate-200 lg:pl-4">
                <p className="truncate text-base font-semibold tracking-tight text-slate-900">{nomeExibicao}</p>
                <p className="text-xs font-medium text-slate-500">Legislação municipal · Blumenau-SC</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  selo === "Conforme"
                    ? "bg-emerald-100 text-emerald-800"
                    : selo === "Bloqueio de Ocupação"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {selo}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium tabular-nums text-slate-700">
                Tempo economizado: {totalAnalises * HORAS_ECONOMIZADAS_POR_ANALISE}h
              </span>
              <button
                type="button"
                disabled={!analiseConcluida}
                onClick={() => {
                  /* Memorial com IA */
                }}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <FileText className="size-4" aria-hidden />
                Memorial descritivo
              </button>
              <button
                type="button"
                onClick={() => setConsultorOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/90 hover:text-emerald-950"
              >
                <MessageCircle className="size-4 text-emerald-700" aria-hidden />
                Consultor IA
              </button>
              <a
                href={GEO_BLUMENAU_URL}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/90 hover:text-emerald-950"
                title="Abrir GEO Blumenau para consulta pública de lote, Consulta para Construir, mapas temáticos e WFS"
              >
                <MapPinned className="size-4 text-emerald-700" aria-hidden />
                GEO Blumenau
                <ExternalLink className="size-3.5 text-slate-500" aria-hidden />
              </a>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-opacity duration-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Coluna 1 — Inputs técnicos (desktop-first) */}
          <aside className="flex min-w-0 flex-col gap-4 lg:col-span-3">
            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-4 shadow-sm ring-1 ring-slate-900/[0.04]">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Entrada inteligente</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Metragens · IA (Llama Vision) + ajuste manual · leis municipais</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="area-terreno-side" className="text-xs font-medium text-slate-600">
                      Área do terreno (m²) <span className="text-red-600">*</span>
                    </Label>
                  </div>
                  <Input
                    id="area-terreno-side"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={areaTerrenoM2Input}
                    onChange={(e) => {
                      setAreaTerrenoM2Input(e.target.value);
                      setIaSugerido((s) => ({ ...s, terreno: false }));
                    }}
                    className="h-10 rounded-lg border-slate-200 bg-white font-mono text-sm tabular-nums transition-colors hover:border-slate-300"
                  />
                  <p className="text-[10px] text-slate-500">Informe pelo memorial ou matrícula; a IA prioriza áreas da edificação na prancha.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="area-coberta-side" className="text-xs font-medium text-slate-600">
                      Área construída total (m²)
                    </Label>
                    {iaSugerido.construida ? <IaSugestaoBadge /> : null}
                  </div>
                  <Input
                    id="area-coberta-side"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={areaConstruidaProjetoInput}
                    onChange={(e) => {
                      setAreaConstruidaProjetoInput(e.target.value);
                      setIaSugerido((s) => ({ ...s, construida: false }));
                    }}
                    className="h-10 rounded-lg border-slate-200 bg-white font-mono text-sm tabular-nums transition-colors hover:border-emerald-200/80 focus-visible:border-emerald-400/60"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="area-perm-side" className="text-xs font-medium text-slate-600">
                      Área permeável (m²)
                    </Label>
                    {iaSugerido.permeavel ? <IaSugestaoBadge /> : null}
                  </div>
                  <Input
                    id="area-perm-side"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={areaPermeavelPropostaInput}
                    onChange={(e) => {
                      setAreaPermeavelPropostaInput(e.target.value);
                      setIaSugerido((s) => ({ ...s, permeavel: false }));
                    }}
                    className="h-10 rounded-lg border-slate-200 bg-white font-mono text-sm tabular-nums transition-colors hover:border-emerald-200/80 focus-visible:border-emerald-400/60"
                  />
                </div>
                {result?.checklist?.extracao_visao?.area_projecao_horizontal_m2 != null &&
                Number.isFinite(result.checklist.extracao_visao.area_projecao_horizontal_m2) ? (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 sm:col-span-2 lg:col-span-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-emerald-900">Área de projeção no terreno (IA)</p>
                      <IaSugestaoBadge />
                    </div>
                    <p className="mt-1 font-mono text-sm tabular-nums text-slate-800">
                      {result.checklist.extracao_visao.area_projecao_horizontal_m2.toFixed(2)} m²
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">Base para taxa de ocupação (Art. 21); confira no quadro de áreas.</p>
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="uso-side" className="text-xs font-medium text-slate-600">
                    Uso da edificação
                  </Label>
                  <select
                    id="uso-side"
                    value={usoImovelInput}
                    onChange={(e) => setUsoImovelInput(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 transition-colors hover:border-slate-300"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Misto">Misto</option>
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="zona-side" className="text-xs font-medium text-slate-600">
                    Zona urbanística
                  </Label>
                  <select
                    id="zona-side"
                    disabled={loadingNormas}
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500/25 disabled:opacity-50"
                  >
                    {normas.map((n) => (
                      <option key={n.zona_urbanistica} value={n.zona_urbanistica}>
                        {n.zona_urbanistica}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="restricao-solo-side" className="text-xs font-medium text-slate-600">
                    Restrição geotécnica / uso do solo
                  </Label>
                  <select
                    id="restricao-solo-side"
                    value={restricaoUsoSoloInput}
                    onChange={(e) => setRestricaoUsoSoloInput(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500/25"
                  >
                    <option value="nao_informado">Não informado</option>
                    <option value="sem_restricao">Sem restrição conhecida</option>
                    <option value="liberada_com_restricao">Liberada com restrição</option>
                    <option value="em_estudo">Em Estudo</option>
                    <option value="interditado">Interditado</option>
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Se “Em Estudo” ou “Interditado”, o painel exigirá EGGA assinado por profissional com CREA.
                  </p>
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 sm:col-span-2 lg:col-span-1">
                  <input
                    type="checkbox"
                    checked={isTombadoInput}
                    onChange={(e) => setIsTombadoInput(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>
                    <span className="block font-medium text-slate-800">Imóvel tombado / patrimônio histórico</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      Aplica o filtro do Art. 68 da LC 1247/2019 e condiciona parâmetros edilícios ao órgão de patrimônio.
                    </span>
                  </span>
                </label>
              </div>
              <div className="mt-4 border-t border-slate-200/80 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reauditLoading || !result?.checklist?.extracao_visao || !zona}
                  className="w-full border-emerald-200/80 text-emerald-900 hover:bg-emerald-50/90 sm:w-auto"
                  onClick={() => void runReauditComValoresAtuais()}
                >
                  {reauditLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Recalculando 70B…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <ScrollText className="size-4" aria-hidden />
                      Aplicar valores e reauditar (Llama 3 70B)
                    </span>
                  )}
                </Button>
                <p className="mt-2 text-[10px] leading-snug text-slate-500">
                  Ajuste as metragens acima e reexecute só a auditoria jurídica (potencial, Art. 41, permeável) sem nova leitura da imagem.
                </p>
              </div>
            </div>

            <div className="flex min-h-[380px] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prancha</p>
              <div
                role="presentation"
                onDragEnter={onDrag}
                onDragLeave={onDrag}
                onDragOver={onDrag}
                onDrop={onDrop}
                className={`relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-lg border border-dashed transition-colors duration-200 ${
                  dragActive ? "border-emerald-400/60 bg-emerald-50/30" : "border-slate-200 bg-slate-50/40"
                }`}
              >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />

              {!preview && !pdfObjectUrl ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                  <UploadCloud size={48} className="mb-4 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-700">Arraste a planta do projeto</h3>
                  <p className="mb-6 text-sm text-slate-500">Suporta PNG, JPG ou PDF</p>
                  <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-lg bg-slate-200 px-5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-300"
                    >
                      Escolher arquivo
                    </button>
                    <button
                      type="button"
                      disabled={analyzing || convertingPdf || !podeAnalisarImagem}
                      onClick={() => void runAnalyze()}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                    >
                      {analyzing || convertingPdf ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          {convertingPdf ? "Convertendo PDF..." : "Analisando..."}
                        </span>
                      ) : (
                        "Analisar com IA"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="relative flex min-h-[320px] flex-1 flex-col bg-white/60">
                <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                  {preview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={preview}
                      alt="Pré-visualização da planta"
                      className="max-h-[min(56vh,560px)] w-full max-w-full object-contain drop-shadow-sm"
                    />
                  ) : (
                    <iframe
                      title="Pré-visualização PDF"
                      src={pdfObjectUrl ?? undefined}
                      className="h-[min(56vh,560px)] w-full max-w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                    />
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-5 pt-12">
                  <button
                    type="button"
                    disabled={analyzing || convertingPdf || !podeAnalisarImagem}
                    onClick={() => void runAnalyze()}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {analyzing || convertingPdf ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {convertingPdf ? "Convertendo PDF..." : "Analisando..."}
                      </span>
                    ) : (
                      "Analisar com IA"
                    )}
                  </button>
                  {!podeAnalisarImagem && pdfObjectUrl ? (
                    <p className="max-w-sm text-center text-xs text-slate-500">
                      Convertendo PDF para JPG automaticamente. A analise libera quando terminar.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Trocar arquivo
                    </button>
                    <button
                      type="button"
                      onClick={clearPreview}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
              )}
              </div>
            </div>

          {pdfObjectUrl && !preview ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
              <FileText className="size-4 shrink-0 text-slate-400" />
              {convertingPdf
                ? "PDF carregado - convertendo para JPG para analise por IA."
                : "PDF carregado - use imagem para analise direta ou fluxo por URL abaixo."}
            </div>
          ) : null}

          <details className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Opções avançadas (projeto + URL)</summary>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Área permeável e demais metragens estão no card <span className="font-medium text-slate-700">Entrada inteligente</span> acima.
              </p>
              <div className="space-y-2">
                <Label htmlFor="insc-d">Inscrição imobiliária</Label>
                <Input
                  id="insc-d"
                  value={inscricao}
                  onChange={(e) => setInscricao(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url-d">URL pública da planta</Label>
                <Input
                  id="url-d"
                  value={urlPlanta}
                  onChange={(e) => setUrlPlanta(e.target.value)}
                  placeholder="https://…"
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={creatingProj} onClick={() => void criarProjeto()}>
                  {creatingProj ? <Loader2 className="size-4 animate-spin" /> : null}
                  Criar projeto
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={analyzing || !projetoId || !urlPlanta.trim()}
                  onClick={() => void salvarUrlProjeto()}
                >
                  Salvar URL
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={analyzing || !projetoId} onClick={() => void runAnalyzePorProjeto()}>
                  Analisar por projeto
                </Button>
              </div>
              {projetoId ? (
                <p className="text-xs text-slate-500">
                  ID (cadastro avançado): {projetoId}
                  {base64
                    ? " — no fluxo principal, cada análise com IA cria um novo registro em projetos e envia a prancha ao Storage."
                    : ""}
                </p>
              ) : null}
            </div>
          </details>
          </aside>

          {/* Coluna 2 — Auditoria */}
          <section className="min-w-0 space-y-5 lg:col-span-6">
          {analyzing ? (
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-emerald-50/40 to-white p-5 shadow-sm transition-all duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Loader2 className="size-4 shrink-0 animate-spin text-emerald-600" aria-hidden />
                  Análise com IA em curso
                </div>
                <time
                  className="tabular-nums text-lg font-semibold tracking-tight text-emerald-800"
                  dateTime={`PT${elapsedSec}S`}
                >
                  {formatElapsed(elapsedSec)}
                </time>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                O tempo depende do modelo na Replicate e do tamanho da prancha (costuma levar de 15 s a 2 min).
              </p>
              <table className="mt-4 w-full border-collapse text-left text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-medium">Etapa</th>
                    <th className="py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 pr-2">Prancha e zona selecionada</td>
                    <td className="py-2.5 text-emerald-700">Pronto</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-2">Modelo de visão (Replicate)</td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Em execução…
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-2">Checklist estruturado</td>
                    <td className="py-2.5 text-slate-500">Aguardando resposta…</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">Auditoria urbanística</h3>
                <p className="text-xs text-slate-500">Medida na planta, regra legal aplicável e status</p>
              </div>
              {result?.checklist?.modo_fallback ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Modo fallback ativo
                </span>
              ) : null}
            </div>
            {result?.checklist?.matriz_conformidade && result.checklist.matriz_conformidade.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="table-auto w-full min-w-[680px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 font-medium text-slate-700">Medida planta</th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Regra legal</th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Origem Legal</th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {result.checklist.matriz_conformidade.map((row, idx) => (
                      <tr
                        key={`${row.medida_identificada}-${idx}`}
                        className="bg-white transition-colors duration-150 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2.5 align-top text-xs font-medium">{row.medida_identificada}</td>
                        <td className="px-3 py-2.5 align-top text-xs text-slate-600">
                          {regraLc751Literal(row.medida_identificada, row.regra_lc751)}
                        </td>
                        <td className="px-3 py-2.5 align-top text-xs text-slate-600">
                          <span className="inline-flex rounded-md border border-emerald-100 bg-emerald-50/70 px-2 py-1 text-[11px] font-medium text-emerald-900">
                            {row.origem_legal || `Zoneamento - Zona ${zona}`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {(() => {
                            const s = toUiStatusFinalBoss(row.status_conformidade);
                            return (
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(s)}`}>
                                {s}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center text-sm text-slate-500">
                Envie a prancha e execute a análise para montar a matriz de conformidade.
              </p>
            )}
          </div>

          {result?.checklist ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">Checklist da Planta — Tem vs Falta</h4>
                <div className="flex items-center gap-2">
                  <label htmlFor="categoria-checklist" className="text-xs text-slate-500">
                    Categoria:
                  </label>
                  <select
                    id="categoria-checklist"
                    value={categoriaChecklist}
                    onChange={(e) => setCategoriaChecklist(e.target.value as CategoriaChecklist)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="todas">Todas</option>
                    <option value="recuos">Recuos</option>
                    <option value="to">Taxa de Ocupação</option>
                    <option value="permeabilidade">Permeabilidade</option>
                    <option value="art41">Art. 41 / ARCO</option>
                    <option value="potencial">Potencial / CA</option>
                    <option value="outros">Outros</option>
                  </select>
                  <span className="text-xs text-slate-500">Total: {resumoChecklist.total}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-medium text-emerald-800">Tem</p>
                  <p className="text-2xl font-bold text-emerald-700">{temFiltrado.length}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-medium text-amber-800">Falta</p>
                  <p className="text-2xl font-bold text-amber-700">{faltaFiltrado.length}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">O que tem na planta</p>
                  {temFiltrado.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Nenhum item validado ainda.</p>
                  ) : (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {temFiltrado.slice(0, 8).map((i, idx) => (
                        <li key={`${i.id}-ok-${idx}`}>{i.rotulo}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">O que falta na planta</p>
                  {faltaFiltrado.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Sem pendências detectadas.</p>
                  ) : (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {faltaFiltrado.slice(0, 8).map((i, idx) => (
                        <li key={`${i.id}-pend-${idx}`}>
                          {i.rotulo}
                          {i.detalhe ? ` — ${i.detalhe}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">
              Parâmetros e acompanhamento{loadingNormas || !zona ? "" : ` · ${zona}`}
            </h3>
            <p className="mb-4 text-xs text-slate-500">Dados da zona, alertas complementares e exportação técnica.</p>

            {result?.norma ? (
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Parâmetros: recuo frontal mín. {result.norma.recuo_frontal_min} m · TO máx.{" "}
                {taxaOcupacaoParaPercentual(result.norma.taxa_ocupacao_max).toFixed(1)}% · CA máx.{" "}
                {result.norma.indice_aproveitamento_max} · permeável mín.{" "}
                {areaPermeavelParaPercentual(result.norma.taxa_permeabilidade_min).toFixed(1)}%
              </p>
            ) : null}

            {result?.checklist?.alertas_criticos?.length ? (
              <div className="mb-4 space-y-2">
                {result.checklist.alertas_criticos.map((a) => (
                  <div
                    key={`${a.codigo}-${a.titulo}`}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all duration-200 hover:shadow-sm ${
                      a.severidade === "critico"
                        ? "border-red-300 bg-red-50 text-red-950"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    <p className="font-semibold">{a.titulo}</p>
                    <p className="mt-1 leading-relaxed opacity-95">{a.mensagem}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {result?.checklist?.potencial ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Potencial construtivo (indicativo)</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                  <li>Terreno declarado: {result.checklist.potencial.area_terreno_m2} m²</li>
                  <li>CA máximo: {result.checklist.potencial.coeficiente_aproveitamento_max}</li>
                  <li>Limite área construída (× CA): ~{result.checklist.potencial.limite_area_construida_m2.toFixed(1)} m²</li>
                  <li>
                    Estimativa IA:{" "}
                    {result.checklist.potencial.area_construida_estimada_ia_m2 != null
                      ? `${result.checklist.potencial.area_construida_estimada_ia_m2.toFixed(1)} m²`
                      : "—"}
                    {result.checklist.potencial.utilizacao_coeficiente_pct != null
                      ? ` (${result.checklist.potencial.utilizacao_coeficiente_pct.toFixed(0)}% do limite)`
                      : ""}
                  </li>
                  <li>Status: {result.checklist.potencial.status}</li>
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{result.checklist.potencial.nota_tecnica}</p>
              </div>
            ) : null}

            {result?.checklist?.otimizacao_sugestao_ia?.trim() ? (
              <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950">
                <p className="font-semibold text-emerald-900">Otimização</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{result.checklist.otimizacao_sugestao_ia}</p>
              </div>
            ) : null}

            {result?.checklist ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                  disabled={!result?.rawOutput}
                  onClick={() => {
                    void import("@/lib/gabarito/relatorio-pdf").then(
                      ({ downloadRelatorioPdf }) => {
                        downloadRelatorioPdf({
                          zona,
                          nomeProjeto: nomeExibicao,
                          areaTerrenoM2: result?.area_terreno_m2 ?? result?.checklist?.entrada?.area_terreno_m2 ?? null,
                          areaConstruidaProjetoM2:
                            Number.isFinite(Number(areaConstruidaProjetoInput.trim().replace(",", ".")))
                              ? Number(areaConstruidaProjetoInput.trim().replace(",", "."))
                              : null,
                          areaPermeavelPropostaM2:
                            Number.isFinite(Number(areaPermeavelPropostaInput.trim().replace(",", ".")))
                              ? Number(areaPermeavelPropostaInput.trim().replace(",", "."))
                              : null,
                          usoEdificacao: usoImovelInput,
                          checklist: result.checklist,
                          ultimaAnaliseIa: result.ultima_analise_ia ?? null,
                        });
                      },
                    );
                  }}
                >
                  <Download className="size-4" aria-hidden />
                  Gerar Relatório Técnico de Pré-Análise (PDF)
                </Button>
              </div>
            ) : null}

            {result?.checklist?.divergencias_resumo &&
            result.checklist.divergencias_resumo.trim() !== (result.checklist.analise_bruta ?? "").trim() ? (
              <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                {result.checklist.divergencias_resumo}
              </p>
            ) : null}
            {result?.checklist?.analise_bruta && !looksLikeRawJsonDump(result.checklist.analise_bruta) ? (
              <p className="mb-4 text-sm leading-relaxed text-slate-700">{result.checklist.analise_bruta}</p>
            ) : null}

            {result?.rawOutput && (!result.checklist?.itens?.length || result.checklist.itens.length === 0) ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                {result.resultado_ia ?? result.rawOutput}
              </pre>
            ) : null}
          </div>

          </section>

          {/* Coluna 3 — Insights */}
          <aside className="min-w-0 space-y-4 lg:col-span-3 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coeficiente de aproveitamento (CA)</h3>
              <p className="mt-2 text-xs text-slate-600">
                Limite indicativo (terreno × CA):{" "}
                <span className="font-mono font-medium text-slate-900">
                  {limitePotencial != null ? `${limitePotencial.toFixed(1)} m²` : "—"}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Área construída considerada:{" "}
                <span className="font-mono font-medium text-slate-900">
                  {areaUsada != null ? `${areaUsada.toFixed(1)} m²` : "—"}
                </span>
              </p>
              {mostrarCaGauge ? (
                <div className="mt-4 flex flex-col items-center border-t border-slate-100 pt-4">
                  <CaGauge utilizacaoPct={ratioPotencial} />
                  <p className="mt-2 text-center text-[11px] text-slate-500">Aproveitamento do limite vinculado ao CA da zona</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Informe terreno, zona e área construída (ou conclua a análise) para o gauge.</p>
              )}
              {potencialRestante != null && potencialRestante > 0 ? (
                <p className="mt-3 text-center text-xs font-semibold text-amber-800">
                  Área indicativa livre: +{potencialRestante.toFixed(1)} m²
                </p>
              ) : null}
              <Button
                type="button"
                className="mt-4 w-full bg-emerald-600 font-semibold text-white shadow-[0_0_22px_-6px_rgba(16,185,129,0.65)] transition hover:bg-emerald-700 hover:shadow-[0_0_28px_-5px_rgba(16,185,129,0.75)]"
                onClick={() => void abrirOtimizacaoLlama()}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Sparkles className="size-4" aria-hidden />
                  Sugerir otimização · Llama 3 70B
                </span>
              </Button>
            </div>

            {result?.checklist?.parecer_tecnico_llama?.trim() ? (
              <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 p-4 shadow-sm ring-1 ring-emerald-900/5 transition-shadow duration-200 hover:shadow-md">
                <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                    <ScrollText className="size-4" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-900/90">Parecer do Auditor IA</h3>
                    <p className="text-[10px] text-slate-500">Llama 3 70B · visão estruturada + leis municipais</p>
                  </div>
                </div>
                <div className="mt-3 max-h-[min(22rem,50vh)] overflow-y-auto pr-1 text-sm leading-relaxed text-slate-700">
                  <p className="whitespace-pre-wrap">{result.checklist.parecer_tecnico_llama}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risco ambiental · Art. 41</h3>
              <p className="mt-2 text-xs text-slate-600">
                APR / ARCO:{" "}
                <span className={alertaArt41 ? "font-semibold text-red-700" : "font-medium text-slate-800"}>
                  {alertaArt41 ? "Bloqueio detectado" : "Sem bloqueio automático"}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Cota 12 m:{" "}
                {result?.checklist?.inferencia_cota_enchente_12m ? (
                  <span className="font-medium text-amber-800">Sinal na análise</span>
                ) : (
                  <span className="text-slate-700">Sem evidência na análise</span>
                )}
              </p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risco de reprovação (checklist)</p>
              <p className={`text-xl font-bold tabular-nums ${riscoToneClass[riscoReprov.tone]}`}>{riscoReprov.label}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permeabilidade · Art. 22</h3>
              <p className="mt-2 text-xs text-slate-600">
                Mínimo:{" "}
                <span className="font-mono font-medium text-slate-900">
                  {permeavelMinima != null ? `${permeavelMinima.toFixed(1)} m²` : "—"}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Proposta:{" "}
                <span className="font-mono font-medium text-slate-900">
                  {Number.isFinite(areaPermeavelPropostaNum) ? `${areaPermeavelPropostaNum.toFixed(1)} m²` : "—"}
                </span>
              </p>
              <p className={`mt-2 text-xs font-semibold ${permeavelOk == null ? "text-slate-600" : permeavelOk ? "text-emerald-700" : "text-amber-700"}`}>
                {permeavelOk == null ? "Informe área permeável para validar." : permeavelOk ? "Conforme mínimo de 20%." : "Abaixo do mínimo de 20%."}
              </p>
            </div>

            {result?.projeto_id ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm shadow-sm">
                <h4 className="font-semibold text-slate-900">Relatório oficial (legislação municipal)</h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  Análise gravada com ID{" "}
                  <span className="rounded bg-white px-1 font-mono text-[11px] text-slate-800">{result.projeto_id}</span>.
                  Referências: Art. 22 (permeabilidade), Art. 35 (recuos), Arts. 13 e 20 (CA e potencial indicativo).
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                  <li>
                    Área do terreno: {result.area_terreno_m2 != null ? `${result.area_terreno_m2} m²` : "—"}
                  </li>
                  <li>
                    Potencial não utilizado (limite CA − estimativa):{" "}
                    {result.area_restante_potencial_m2 != null && Number.isFinite(result.area_restante_potencial_m2)
                      ? `${result.area_restante_potencial_m2} m²`
                      : "—"}
                  </li>
                </ul>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      void (async () => {
                        let checklist = result.checklist;
                        let nome = nomeExibicao;
                        let zonaPdf = zona;
                        let areaT = result.area_terreno_m2 ?? null;
                        let areaR = result.area_restante_potencial_m2 ?? null;
                        let ultimaPdf: string | null = result.ultima_analise_ia ?? null;
                        try {
                          const res = await fetch(`/api/projetos/${result.projeto_id}`);
                          const data = (await res.json()) as {
                            projeto?: {
                              nome?: string | null;
                              zona_urbanistica?: string;
                              area_terreno_m2?: number | null;
                              area_restante_potencial_m2?: number | null;
                              status_checklist?: StatusChecklist;
                              ultima_analise_ia?: string | null;
                            };
                          };
                          if (res.ok && data.projeto?.status_checklist) {
                            checklist = data.projeto.status_checklist as StatusChecklist;
                            nome = (data.projeto.nome?.trim() || nome) as string;
                            zonaPdf = data.projeto.zona_urbanistica ?? zonaPdf;
                            areaT =
                              data.projeto.area_terreno_m2 != null && data.projeto.area_terreno_m2 !== undefined
                                ? Number(data.projeto.area_terreno_m2)
                                : areaT;
                            areaR =
                              data.projeto.area_restante_potencial_m2 !== undefined
                                ? data.projeto.area_restante_potencial_m2
                                : areaR;
                            if (typeof data.projeto.ultima_analise_ia === "string" && data.projeto.ultima_analise_ia.trim()) {
                              ultimaPdf = data.projeto.ultima_analise_ia;
                            }
                          }
                        } catch {
                          /* mantém estado em memória */
                        }
                        const { downloadRelatorioOficialLc751Pdf } = await import("@/lib/gabarito/relatorio-oficial-lc751-pdf");
                        downloadRelatorioOficialLc751Pdf({
                          projetoId: result.projeto_id!,
                          nomeProjeto: nome,
                          zona: zonaPdf,
                          areaTerrenoM2: areaT,
                          areaRestantePotencialM2: areaR,
                          checklist,
                          ultimaAnaliseIa: ultimaPdf,
                        });
                      })();
                    }}
                  >
                    <Download className="size-4" aria-hidden />
                    Baixar relatório oficial
                  </Button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/90 py-2.5 text-center text-[11px] leading-snug text-slate-500 shadow-[0_-1px_12px_rgba(15,23,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
        Baseado no conjunto de leis municipais mapeadas. Esta pré-análise não substitui a consulta oficial à SEPLAN/Blumenau.
      </footer>

      <ConsultorIADrawer
        open={consultorOpen}
        onOpenChange={setConsultorOpen}
        formContext={consultorFormContext}
        checklistSnapshot={result?.checklist ?? null}
        normaResumo={result?.norma ?? normas.find((n) => n.zona_urbanistica === zona) ?? null}
      />

      {showModalOtimizar ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="size-5 text-emerald-600" aria-hidden />
              <h4 className="text-base font-semibold tracking-tight text-slate-900">Otimização · Llama 3 70B (Art. 20)</h4>
            </div>
            {otimizacaoIaLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />
                Gerando sugestão com base no potencial e na legislação municipal…
              </div>
            ) : null}
            {otimizacaoIaError ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {otimizacaoIaError} — exibindo texto de contingência abaixo.
              </p>
            ) : null}
            {!otimizacaoIaLoading ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {otimizacaoIaText ?? fallbackTextoOtimizacao()}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowModalOtimizar(false);
                  setOtimizacaoIaText(null);
                  setOtimizacaoIaError(null);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
