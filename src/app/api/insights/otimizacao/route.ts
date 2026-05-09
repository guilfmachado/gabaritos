import { NextResponse } from "next/server";
import { runLlamaAuditPrompt } from "@/lib/replicate/run-llama-text";

export const runtime = "nodejs";
export const maxDuration = 90;

type Body = {
  zona_urbanistica?: string;
  uso_imovel?: string;
  area_terreno_m2?: number;
  area_construida_m2?: number | null;
  area_permeavel_m2?: number | null;
  limite_area_construida_m2?: number | null;
  coeficiente_aproveitamento_max?: number | null;
  matriz_itens?: { medida: string; status: string }[];
};

function buildPrompt(b: Body): string {
  const zona = (b.zona_urbanistica ?? "").trim() || "—";
  const uso = (b.uso_imovel ?? "").trim() || "—";
  const at = b.area_terreno_m2;
  const ac = b.area_construida_m2;
  const ap = b.area_permeavel_m2;
  const lim = b.limite_area_construida_m2;
  const ca = b.coeficiente_aproveitamento_max;
  const livre =
    lim != null && ac != null && Number.isFinite(lim) && Number.isFinite(ac) ? Math.max(0, lim - ac) : null;

  const matriz =
    b.matriz_itens?.slice(0, 12).map((r) => `- ${r.medida}: ${r.status}`).join("\n") ?? "(sem itens)";

  return `Você é consultor de arquitetura e urbanismo em Blumenau/SC, alinhado à LC 751/2010.

Dados do projeto:
- Zona urbanística: ${zona}
- Uso declarado: ${uso}
- Área do terreno: ${at != null ? `${at} m²` : "—"}
- Coeficiente de aproveitamento máximo (CA): ${ca != null ? String(ca) : "—"}
- Limite indicativo de área construída (terreno × CA): ${lim != null ? `${lim.toFixed(1)} m²` : "—"}
- Área construída (valores finais do formulário / auditoria): ${ac != null ? `${ac.toFixed(1)} m²` : "—"}
- Área permeável informada: ${ap != null ? `${ap.toFixed(1)} m²` : "—"}
- Área ainda disponível até o limite indicativo: ${livre != null ? `${livre.toFixed(1)} m²` : "—"}

Trecho da matriz de auditoria (referência):
${matriz}

Instruções:
1) Se a área disponível for maior que zero, explique em 3–5 parágrafos curtos em português do Brasil onde o projeto pode ampliar área construída (ex.: novos pavimentos dentro do envelope, ampliação de suítes ou varandas), sempre lembrando TO máximo, recuos laterais/de fundos (Art. 35: mínimo H/6 — ex.: H=18 m implica 3 m) e permeabilidade (Art. 22: 20%).
2) Cite explicitamente o Art. 35-A da LC 751/2010: afastamento mínimo de 1,50 m para vãos de portas e janelas em relação ao alinhamento frontal e aos recuos obrigatórios, ao sugerir novas aberturas ou fachadas.
3) Se não houver área disponível (ou dados insuficientes), diga claramente que o indicativo está no limite ou que faltam dados — sem inventar números.
4) Tom profissional, sem markdown, sem título.
5) Ancore a oportunidade de lucro no Art. 20 da LC 751/2010 (área construída permitida = CA × área escriturada): quantifique m² adicionais possíveis e como isso se traduz em produto (tipologias, pavimentação) sem violar TO (Art. 21), recuos (Art. 35 H/6) e permeabilidade (Art. 22).`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (body.area_terreno_m2 == null || !Number.isFinite(Number(body.area_terreno_m2)) || Number(body.area_terreno_m2) <= 0) {
    return NextResponse.json({ error: "area_terreno_m2 é obrigatório e deve ser > 0." }, { status: 400 });
  }

  try {
    const texto = await runLlamaAuditPrompt(buildPrompt(body), 2048);
    if (!texto) {
      return NextResponse.json({ error: "Modelo não retornou texto." }, { status: 502 });
    }
    return NextResponse.json({ texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar insight.";
    console.error("[insights/otimizacao]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
