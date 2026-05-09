import { analyzeProjetoById } from "@/lib/gabarito/analyze-projeto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await analyzeProjetoById(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    projeto_id: result.projeto_id,
    checklist: result.checklist,
    resultado_ia: result.resultado_ia,
    ultima_analise_ia: result.ultima_analise_ia,
    norma: result.norma,
    imagem_utilizada: result.imagem_utilizada,
    area_terreno_m2: result.area_terreno_m2,
    area_restante_potencial_m2: result.area_restante_potencial_m2,
  });
}
