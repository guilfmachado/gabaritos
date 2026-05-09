import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const BUCKET = "plantas";

/**
 * Envia a prancha ao Storage `plantas/{projetoId}/{uuid}.(png|jpg)`.
 * Retorna URL pública ou null se o bucket/policies não estiverem configurados.
 */
export async function uploadPlantaProjeto(
  supabase: SupabaseClient,
  projetoId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `${projetoId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.warn("[gabarito] upload plantas:", error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
