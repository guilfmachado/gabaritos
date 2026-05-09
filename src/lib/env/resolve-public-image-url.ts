import { logMissingServerEnv, throwMissingEnv } from "@/lib/env/missing-env-log";

/**
 * Garante URL absoluta https para fetch/Replicate.
 * A Replicate não acessa file:// nem caminhos relativos sem origem pública.
 *
 * Ordem: URL absoluta → URL // → NEXT_PUBLIC_SITE_URL + path → NEXT_PUBLIC_SUPABASE_URL + path.
 */
export function resolvePublicImageUrlForServer(raw: string): string {
  const u = raw.trim();
  if (!u) {
    throw new Error("URL da planta vazia. Use URL pública (Storage Supabase ou CDN) ou NEXT_PUBLIC_SITE_URL + path.");
  }
  if (/^https?:\/\//i.test(u)) {
    return u;
  }
  if (u.startsWith("//")) {
    return `https:${u}`;
  }
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");

  if (u.startsWith("/")) {
    if (siteBase) {
      return `${siteBase}${u}`;
    }
    if (supabaseBase) {
      return `${supabaseBase}${u}`;
    }
    logMissingServerEnv(
      "NEXT_PUBLIC_SITE_URL ou NEXT_PUBLIC_SUPABASE_URL",
      "A URL da planta é relativa; defina NEXT_PUBLIC_SITE_URL (ex.: https://seu-app.vercel.app) ou use URL absoluta do Storage.",
    );
    throwMissingEnv(
      "NEXT_PUBLIC_SITE_URL",
      "Necessária quando a URL da planta salva no banco é relativa (começa com /). Alternativa: gravar sempre URL absoluta do Supabase Storage.",
    );
  }

  logMissingServerEnv(
    "URL da planta",
    `Valor recebido não é URL absoluta (esperado https://…). Recebido: "${u.slice(0, 80)}${u.length > 80 ? "…" : ""}". Salve no banco a URL pública completa do Storage ou defina NEXT_PUBLIC_SITE_URL se usar path relativo.`,
  );
  throw new Error(
    "URL da planta deve ser absoluta (https://…), típica do Supabase Storage. A Replicate não acessa URLs locais ou relativas sem NEXT_PUBLIC_SITE_URL.",
  );
}
