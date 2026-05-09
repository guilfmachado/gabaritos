import type { NextConfig } from "next";

/**
 * Deploy Vercel: defina variáveis em Project → Settings → Environment Variables.
 * Ver `.env.example` e `vercel.json` (maxDuration 60s nas rotas de análise).
 * SUPABASE_SERVICE_ROLE_KEY e REPLICATE_API_TOKEN só no servidor — nunca NEXT_PUBLIC_*.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
