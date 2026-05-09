import { computeAreaRestantePotencialM2, type MetricasTerrenoPrecomputadas } from "@/lib/gabarito/metricas-terreno";
import { uploadPlantaProjeto } from "@/lib/supabase/upload-planta";
import type { MetricasTerrenoSnapshot, StatusChecklist } from "@/types/gabarito";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertProjetoAnalisePayload = {
  nome: string;
  zonaUrbanistica: string;
  areaTerrenoM2: number;
  checklist: StatusChecklist;
  rawOutput: string;
  /** Texto bruto Llama Vision (extração). */
  visionRaw?: string;
  /** Texto bruto Llama 70B (auditoria). */
  auditRaw?: string;
  imageBuffer: Buffer;
  mimeType: string;
  userId?: string | null;
};

/** Texto longo para `ultima_analise_ia` e relatórios (parecer + anexos). */
export function composeUltimaAnaliseIa(
  checklist: StatusChecklist,
  auditRaw: string,
  visionRaw: string,
): string {
  const parts: string[] = [];
  const parecer = checklist.parecer_tecnico_llama?.trim();
  if (parecer) {
    parts.push("PARECER DO AUDITOR IA");
    parts.push("");
    parts.push(parecer);
  }
  const opt = checklist.otimizacao_sugestao_ia?.trim();
  if (opt) {
    parts.push("");
    parts.push("SUGESTÃO DE OTIMIZAÇÃO");
    parts.push("");
    parts.push(opt);
  }
  if (checklist.extracao_visao) {
    parts.push("");
    parts.push("EXTRAÇÃO VISUAL (estruturada)");
    parts.push(JSON.stringify(checklist.extracao_visao, null, 2));
  }
  parts.push("");
  parts.push("--- Auditoria (trecho bruto) ---");
  parts.push(auditRaw.slice(0, 12000));
  if (visionRaw.length > 0) {
    parts.push("");
    parts.push("--- Visão (trecho bruto) ---");
    parts.push(visionRaw.slice(0, 8000));
  }
  return parts.join("\n").slice(0, 50000);
}

export type InsertProjetoAnaliseResult = {
  id: string;
  imagem_planta_url: string | null;
  area_restante_potencial_m2: number | null;
  checklistPersist: StatusChecklist;
  ultima_analise_ia: string;
};

function toMetricasSnapshot(m: MetricasTerrenoPrecomputadas): MetricasTerrenoSnapshot {
  return {
    area_terreno_m2: m.area_terreno_m2,
    area_maxima_construida_m2: m.area_maxima_construida_m2,
    area_projecao_maxima_m2: m.area_projecao_maxima_m2,
    area_permeavel_necessaria_m2: m.area_permeavel_necessaria_m2,
  };
}

function isMissingSchemaColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code !== "PGRST204") return false;
  return typeof e.message === "string" && e.message.includes(`'${column}'`);
}

/** Nova linha em `projetos` com checklist completo, métricas de entrada e área restante (potencial não utilizado). */
export async function insertProjetoAnaliseSnapshot(
  supabase: SupabaseClient,
  metricas: MetricasTerrenoPrecomputadas,
  payload: InsertProjetoAnalisePayload,
): Promise<InsertProjetoAnaliseResult> {
  const areaRestante = computeAreaRestantePotencialM2(
    metricas,
    payload.checklist.area_construida_estimada_ia_m2,
  );

  const checklistPersist: StatusChecklist = {
    ...payload.checklist,
    entrada: { area_terreno_m2: payload.areaTerrenoM2 },
    metricas_servidor: toMetricasSnapshot(metricas),
    area_restante_potencial_m2: areaRestante,
    analise_bruta: payload.checklist.analise_bruta ?? payload.rawOutput,
  };

  const ultimaAnalise = composeUltimaAnaliseIa(
    checklistPersist,
    payload.auditRaw ?? "",
    payload.visionRaw ?? "",
  );

  const insertRow: Record<string, unknown> = {
    nome_projeto: payload.nome.trim() ? payload.nome.trim().slice(0, 200) : null,
    zona_urbanistica: payload.zonaUrbanistica,
    area_terreno_m2: payload.areaTerrenoM2,
    area_restante_potencial_m2: areaRestante,
    status_checklist: checklistPersist as unknown as Record<string, unknown>,
    resultado_ia: payload.rawOutput,
    ultima_analise_ia: ultimaAnalise || payload.rawOutput,
  };
  if (payload.userId) insertRow.user_id = payload.userId;

  let { data, error } = await supabase.from("projetos").insert(insertRow).select("id").single();
  if (
    error &&
    (isMissingSchemaColumnError(error, "area_restante_potencial_m2")
      || isMissingSchemaColumnError(error, "area_terreno_m2")
      || isMissingSchemaColumnError(error, "nome_projeto"))
  ) {
    // Compatibilidade temporária para bancos sem a migration mais recente.
    const fallbackInsert = { ...insertRow };
    delete fallbackInsert.area_restante_potencial_m2;
    if (isMissingSchemaColumnError(error, "nome_projeto")) {
      const nome = fallbackInsert.nome_projeto;
      delete fallbackInsert.nome_projeto;
      fallbackInsert.nome = nome;
    }
    if (isMissingSchemaColumnError(error, "area_terreno_m2")) {
      delete fallbackInsert.area_terreno_m2;
    }
    const retry = await supabase.from("projetos").insert(fallbackInsert).select("id").single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  if (!data?.id) throw new Error("Falha ao inserir projeto: retorno sem ID.");
  const newId = data.id as string;

  const publicUrl = await uploadPlantaProjeto(supabase, newId, payload.imageBuffer, payload.mimeType);
  if (publicUrl) {
    await supabase.from("projetos").update({ imagem_planta_url: publicUrl }).eq("id", newId);
  }

  return {
    id: newId,
    imagem_planta_url: publicUrl,
    area_restante_potencial_m2: areaRestante,
    checklistPersist,
    ultima_analise_ia: ultimaAnalise,
  };
}
