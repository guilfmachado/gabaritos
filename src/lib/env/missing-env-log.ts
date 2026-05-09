/**
 * Mensagens e logs para deploy (Vercel): variáveis ausentes aparecem claros nos logs da função.
 * SUPABASE_SERVICE_ROLE_KEY e REPLICATE_API_TOKEN só em código server (API Routes / Server Actions).
 */

const DEPLOY_HINT =
  "No painel da Vercel: Project → Settings → Environment Variables. Após alterar, faça um novo deploy.";

export function logMissingServerEnv(key: string, detail?: string): void {
  const env = process.env.VERCEL_ENV ?? (process.env.VERCEL ? "vercel" : "local");
  console.error(
    `[gabarito-deploy] Variável de ambiente ausente ou vazia: ${key}. Ambiente: ${env}. ${DEPLOY_HINT}${detail ? ` Detalhe: ${detail}` : ""}`,
  );
}

/** Lista para documentação / mensagens de erro agregadas. */
export const REQUIRED_SERVER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REPLICATE_API_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
] as const;

export function throwMissingEnv(key: string, extra?: string): never {
  logMissingServerEnv(key, extra);
  throw new Error(
    `${key} não está definida ou está vazia. Configure no painel da Vercel (Environment Variables) e redeploy. ${extra ?? ""}`.trim(),
  );
}
