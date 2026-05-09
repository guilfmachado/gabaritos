/**
 * Cliente Supabase com SERVICE_ROLE (admin).
 *
 * ⚠️ NUNCA importe este módulo em Client Components (`"use client"`). A service role
 * ignora RLS e concede acesso total ao banco — use apenas em Server Actions, Route Handlers
 * e outros códigos que executam exclusivamente no servidor.
 */

import { throwMissingEnv } from "@/lib/env/missing-env-log";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throwMissingEnv("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throwMissingEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "Chave apenas no servidor (nunca NEXT_PUBLIC_*). Configure na Vercel em Environment Variables.",
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
