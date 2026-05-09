import { NextResponse } from "next/server";
import { coerceNormaLocal } from "@/lib/gabarito/norma-coerce";
import { createServiceSupabase } from "@/lib/supabase/service";
import { NORMAS_LOCAIS_COLUMNS, type NormaLocal } from "@/types/gabarito";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("normas_locais")
      .select(NORMAS_LOCAIS_COLUMNS)
      .order("zona_urbanistica");

    if (error) {
      console.error("Detalhe do erro do Supabase:", error);
      return NextResponse.json(
        {
          error: error.message ?? "Erro ao consultar normas_locais.",
          supabase: {
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
          table: "normas_locais",
        },
        { status: 500 },
      );
    }

    const normas: NormaLocal[] = (data ?? []).map((row) =>
      coerceNormaLocal(row as Record<string, unknown>),
    );
    return NextResponse.json({ normas });
  } catch (e) {
    console.error("Detalhe do erro do Supabase:", e);
    const message = e instanceof Error ? e.message : "Erro ao carregar normas.";
    return NextResponse.json(
      {
        error: message,
        hint: "Falha antes ou depois da query (ex.: variáveis de ambiente ausentes).",
        table: "normas_locais",
      },
      { status: 500 },
    );
  }
}
