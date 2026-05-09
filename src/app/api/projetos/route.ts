import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("projetos")
      .select(
        "id, nome, zona_urbanistica, inscricao_imobiliaria, planta_url, imagem_planta_url, resultado_ia, status_checklist, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ projetos: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar projetos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PostBody = {
  nome?: string;
  zona_urbanistica: string;
  inscricao_imobiliaria?: string;
  planta_url?: string | null;
  imagem_planta_url?: string | null;
  user_id?: string | null;
};

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body?.zona_urbanistica) {
    return NextResponse.json({ error: "zona_urbanistica é obrigatório." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();
    const urlPrancha = body.imagem_planta_url?.trim() || body.planta_url?.trim() || null;

    const uid =
      typeof body.user_id === "string" && UUID_RE.test(body.user_id.trim())
        ? body.user_id.trim()
        : null;

    const { data, error } = await supabase
      .from("projetos")
      .insert({
        nome: body.nome ?? null,
        zona_urbanistica: body.zona_urbanistica,
        inscricao_imobiliaria: body.inscricao_imobiliaria ?? null,
        planta_url: body.planta_url?.trim() || urlPrancha,
        imagem_planta_url: body.imagem_planta_url?.trim() || urlPrancha,
        user_id: uid,
        status_checklist: { version: 2, itens: [], updatedAt: new Date().toISOString() },
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao criar projeto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
