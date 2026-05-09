import { createServiceSupabase } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("projetos")
      .select(
        "id, nome, zona_urbanistica, area_terreno_m2, area_restante_potencial_m2, status_checklist, resultado_ia, ultima_analise_ia, created_at, imagem_planta_url",
      )
      .eq("id", id.trim())
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ projeto: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar projeto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  planta_url?: string | null;
  imagem_planta_url?: string | null;
  nome?: string | null;
  inscricao_imobiliaria?: string | null;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("planta_url" in body) patch.planta_url = body.planta_url;
  if ("imagem_planta_url" in body) patch.imagem_planta_url = body.imagem_planta_url;
  if ("nome" in body) patch.nome = body.nome;
  if ("inscricao_imobiliaria" in body) patch.inscricao_imobiliaria = body.inscricao_imobiliaria;

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("projetos")
      .update(patch)
      .eq("id", id)
      .select("id, planta_url, imagem_planta_url, nome, inscricao_imobiliaria, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ projeto: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar projeto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
