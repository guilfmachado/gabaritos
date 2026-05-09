import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function createServiceSupabase(): SupabaseClient {
  return getSupabaseAdmin();
}
