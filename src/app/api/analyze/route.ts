import { NextResponse } from "next/server";
import { computeMetricasTerreno } from "@/lib/gabarito/metricas-terreno";
import { coerceNormaLocal } from "@/lib/gabarito/norma-coerce";
import { composeUltimaAnaliseIa, insertProjetoAnaliseSnapshot } from "@/lib/gabarito/persist-analise-projeto";
import { analyzePlantaVision } from "@/lib/replicate/analyze-planta";
import { createServiceSupabase } from "@/lib/supabase/service";
import { NORMAS_LOCAIS_COLUMNS, type NormaLocal, type StatusChecklist } from "@/types/gabarito";

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  imageBase64: string;
  mimeType?: string;
  zona_urbanistica: string;
  /** Se true, grava nova linha em `projetos` (snapshot) com prancha no Storage. */
  persist?: boolean;
  /** Nome exibido / do projeto (até 200 caracteres). */
  nome_projeto?: string;
  /** Área do terreno (m²), obrigatória — idem `area_terreno_m2` (legado). Pode vir como string no JSON. */
  area_terreno?: number | string;
  area_terreno_m2?: number | string;
  area_construida_projeto?: number | string;
  area_permeavel_proposta?: number | string;
  uso?: string;
  uso_imovel?: string;
  /** UUID auth.users, opcional. */
  user_id?: string;
};

function isZonaRisco(zona: string): boolean {
  const z = zona.toUpperCase();
  return z.includes("APR") || z.includes("ARCO");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body?.imageBase64 || !body?.zona_urbanistica) {
    return NextResponse.json(
      { error: "Campos obrigatórios: imageBase64 (sem prefixo data:), zona_urbanistica." },
      { status: 400 },
    );
  }

  const areaTerrenoRaw = body.area_terreno ?? body.area_terreno_m2;
  const areaTerreno =
    typeof areaTerrenoRaw === "string"
      ? Number(areaTerrenoRaw.trim().replace(",", "."))
      : Number(areaTerrenoRaw);
  if (!Number.isFinite(areaTerreno) || areaTerreno <= 0) {
    return NextResponse.json(
      { error: "Campo obrigatório: area_terreno (m²), número maior que zero." },
      { status: 400 },
    );
  }
  const areaConstruidaProjetoRaw = body.area_construida_projeto;
  const areaConstruidaProjeto =
    areaConstruidaProjetoRaw == null
      ? null
      : typeof areaConstruidaProjetoRaw === "string"
        ? Number(areaConstruidaProjetoRaw.trim().replace(",", "."))
        : Number(areaConstruidaProjetoRaw);
  const areaPermeavelPropostaRaw = body.area_permeavel_proposta;
  const areaPermeavelProposta =
    areaPermeavelPropostaRaw == null
      ? null
      : typeof areaPermeavelPropostaRaw === "string"
        ? Number(areaPermeavelPropostaRaw.trim().replace(",", "."))
        : Number(areaPermeavelPropostaRaw);
  const usoImovel = (body.uso_imovel ?? body.uso ?? "").trim();

  try {
    const supabase = createServiceSupabase();
    const { data: normaRow, error: normaError } = await supabase
      .from("normas_locais")
      .select(NORMAS_LOCAIS_COLUMNS)
      .eq("zona_urbanistica", body.zona_urbanistica)
      .maybeSingle();

    if (normaError) throw normaError;
    if (!normaRow) {
      return NextResponse.json(
        { error: `Zona "${body.zona_urbanistica}" não encontrada em normas_locais.` },
        { status: 404 },
      );
    }

    const norma = coerceNormaLocal(normaRow as Record<string, unknown>);

    const metricasPrecomputadas = computeMetricasTerreno(areaTerreno, norma);

    const { rawOutput, checklist, visionRaw, auditRaw } = await analyzePlantaVision({
      imageBase64: body.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: body.mimeType ?? "image/png",
      zona: body.zona_urbanistica,
      norma,
      areaTerrenoM2: areaTerreno,
      metricasPrecomputadas,
      areaConstruidaProjetoM2:
        Number.isFinite(areaConstruidaProjeto ?? NaN) && (areaConstruidaProjeto as number) > 0
          ? (areaConstruidaProjeto as number)
          : null,
      areaPermeavelPropostaM2:
        Number.isFinite(areaPermeavelProposta ?? NaN) && (areaPermeavelProposta as number) >= 0
          ? (areaPermeavelProposta as number)
          : null,
      usoImovel: usoImovel || null,
    });
    if (/residencial/i.test(usoImovel)) {
      checklist.inferencia_uso_residencial = true;
    }
    if (
      Number.isFinite(areaConstruidaProjeto ?? NaN)
      && areaConstruidaProjeto != null
      && checklist.area_construida_estimada_ia_m2 != null
      && Number.isFinite(checklist.area_construida_estimada_ia_m2)
    ) {
      const diff = Math.round((checklist.area_construida_estimada_ia_m2 - areaConstruidaProjeto) * 100) / 100;
      if (Math.abs(diff) >= 0.5) {
        const alert = {
          codigo: "DIVERGENCIA_AREAS",
          severidade: "alerta" as const,
          titulo: "Divergência de Áreas",
          mensagem: `Área construída informada: ${areaConstruidaProjeto.toFixed(2)} m². Leitura estimada da IA: ${checklist.area_construida_estimada_ia_m2.toFixed(2)} m². Diferença: ${diff.toFixed(2)} m².`,
        };
        checklist.alertas_criticos = checklist.alertas_criticos ? [alert, ...checklist.alertas_criticos] : [alert];
      }
    }
    if (/residencial/i.test(usoImovel) && isZonaRisco(body.zona_urbanistica)) {
      const bloqueio = {
        codigo: "BLOQUEIO_OCUPACAO",
        severidade: "critico" as const,
        titulo: "BLOQUEIO DE OCUPAÇÃO (Art. 41, I)",
        mensagem:
          "Proibido uso residencial abaixo da cota 12m em área ARCO/APR, conforme Art. 41, I da LC 751/2010.",
      };
      checklist.alertas_criticos = checklist.alertas_criticos ? [bloqueio, ...checklist.alertas_criticos] : [bloqueio];
    }

    const ultimaAnaliseIa = composeUltimaAnaliseIa(checklist, auditRaw, visionRaw);

    const payload: {
      checklist: StatusChecklist;
      rawOutput: string;
      norma: NormaLocal;
      ultima_analise_ia: string;
      projeto_id?: string;
      area_terreno_m2?: number;
      area_restante_potencial_m2?: number | null;
      imagem_planta_url?: string | null;
      persistError?: string;
    } = {
      checklist,
      rawOutput,
      norma,
      ultima_analise_ia: ultimaAnaliseIa || rawOutput,
    };

    if (body.persist === true) {
      const mime = body.mimeType ?? "image/png";
      const buffer = Buffer.from(
        body.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const nome =
        typeof body.nome_projeto === "string" && body.nome_projeto.trim()
          ? body.nome_projeto.trim()
          : "Análise Gabarito";
      const userId =
        body.user_id && UUID_RE.test(body.user_id) ? body.user_id : null;

      try {
        const saved = await insertProjetoAnaliseSnapshot(supabase, metricasPrecomputadas, {
          nome,
          zonaUrbanistica: body.zona_urbanistica,
          areaTerrenoM2: areaTerreno,
          checklist,
          rawOutput,
          visionRaw,
          auditRaw,
          imageBuffer: buffer,
          mimeType: mime,
          userId,
        });
        payload.projeto_id = saved.id;
        payload.checklist = saved.checklistPersist;
        payload.ultima_analise_ia = saved.ultima_analise_ia;
        payload.area_terreno_m2 = areaTerreno;
        payload.area_restante_potencial_m2 = saved.area_restante_potencial_m2;
        payload.imagem_planta_url = saved.imagem_planta_url;
      } catch (persistErr) {
        payload.persistError =
          persistErr instanceof Error
            ? persistErr.message
            : typeof persistErr === "string"
              ? persistErr
              : JSON.stringify(persistErr);
        console.warn("[api/analyze] falha ao persistir snapshot:", persistErr);
      }
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : `Falha na análise (${JSON.stringify(e)})`;
    // Loga a causa real no servidor para facilitar diagnóstico.
    console.error("[api/analyze] erro:", e);
    const status =
      message.includes("Defina ")
      || /timeout|timed out|ETIMEDOUT/i.test(message)
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
