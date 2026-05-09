"use server";

import { analyzeProjetoById } from "@/lib/gabarito/analyze-projeto";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";

export type AnalyzeProjetoActionState =
  | { status: "idle" }
  | {
      status: "success";
      projeto_id: string;
      checklist: StatusChecklist;
      resultado_ia: string;
      ultima_analise_ia: string;
      norma: NormaLocal;
      imagem_utilizada: string;
      area_terreno_m2: number | null;
      area_restante_potencial_m2: number | null;
    }
  | { status: "error"; message: string };

export async function analyzeProjetoAction(
  _prev: AnalyzeProjetoActionState,
  formData: FormData,
): Promise<AnalyzeProjetoActionState> {
  const projetoId = String(formData.get("projeto_id") ?? "").trim();
  const result = await analyzeProjetoById(projetoId);

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  return {
    status: "success",
    projeto_id: result.projeto_id,
    checklist: result.checklist,
    resultado_ia: result.resultado_ia,
    ultima_analise_ia: result.ultima_analise_ia,
    norma: result.norma,
    imagem_utilizada: result.imagem_utilizada,
    area_terreno_m2: result.area_terreno_m2,
    area_restante_potencial_m2: result.area_restante_potencial_m2,
  };
}
