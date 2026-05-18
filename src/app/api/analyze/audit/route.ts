import { composeUltimaAnaliseIa } from "@/lib/gabarito/persist-analise-projeto";
import { coerceNormaLocal } from "@/lib/gabarito/norma-coerce";
import { appendDeprecatedNormaAlerts, appendRestricaoGeotecnicaAlerts } from "@/lib/gabarito/normas-revogadas";
import { filtrarAlertasEdiliciosPorTombamento } from "@/lib/gabarito/edificacoes-lc1247";
import { auditPlantaFromExtracao } from "@/lib/replicate/analyze-planta";
import { createServiceSupabase } from "@/lib/supabase/service";
import { NORMAS_LOCAIS_COLUMNS, type ExtracaoVisaoLlama } from "@/types/gabarito";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  zona_urbanistica: string;
  area_terreno_m2: number | string;
  area_construida_m2?: number | string | null;
  area_permeavel_m2?: number | string | null;
  uso_imovel?: string | null;
  restricao_uso_solo?: string | null;
  situacao_risco_geotecnico?: string | null;
  is_tombado?: boolean;
  extracao_visao: ExtracaoVisaoLlama;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const zona = String(body.zona_urbanistica ?? "").trim();
  const at = num(body.area_terreno_m2);
  if (!zona || at == null || at <= 0) {
    return NextResponse.json(
      { error: "zona_urbanistica e area_terreno_m2 (> 0) são obrigatórios." },
      { status: 400 },
    );
  }

  const ex = body.extracao_visao;
  if (!ex || typeof ex !== "object") {
    return NextResponse.json(
      { error: "extracao_visao é obrigatória (execute antes a análise por visão)." },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceSupabase();
    const { data: normaRow, error: normaError } = await supabase
      .from("normas_locais")
      .select(NORMAS_LOCAIS_COLUMNS)
      .eq("zona_urbanistica", zona)
      .maybeSingle();

    if (normaError) throw normaError;
    if (!normaRow) {
      return NextResponse.json({ error: `Zona "${zona}" não encontrada.` }, { status: 404 });
    }

    const norma = coerceNormaLocal(normaRow as Record<string, unknown>);
    const ac = num(body.area_construida_m2);
    const ap = num(body.area_permeavel_m2);
    const uso = typeof body.uso_imovel === "string" ? body.uso_imovel.trim() : "";
    const restricaoUsoSolo =
      (typeof body.restricao_uso_solo === "string" ? body.restricao_uso_solo : body.situacao_risco_geotecnico ?? "")
        .trim();
    const isTombado = body.is_tombado === true;

    const auditResult = await auditPlantaFromExtracao({
      zona,
      norma,
      extracao: ex,
      areaTerrenoM2: at,
      areaConstruidaProjetoM2: ac != null && ac > 0 ? ac : null,
      areaPermeavelPropostaM2: ap != null && ap >= 0 ? ap : null,
      usoImovel: uso || null,
      restricaoUsoSolo: restricaoUsoSolo || null,
      isTombado,
    });
    const auditRaw = auditResult.auditRaw;
    let checklist = auditResult.checklist;
    checklist = appendDeprecatedNormaAlerts(checklist, [body, auditRaw]);
    checklist = appendRestricaoGeotecnicaAlerts(checklist, restricaoUsoSolo);
    checklist.alertas_criticos = filtrarAlertasEdiliciosPorTombamento(checklist.alertas_criticos, isTombado);

    const ultima_analise_ia = composeUltimaAnaliseIa(checklist, auditRaw, "");

    return NextResponse.json({
      checklist,
      ultima_analise_ia,
      audit_raw: auditRaw,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na auditoria.";
    console.error("[api/analyze/audit]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
