import Replicate from "replicate";

export type VisionModelRunRef = `${string}/${string}` | `${string}/${string}:${string}`;

/**
 * A Replicate não aceita `POST /v1/models/{owner}/{name}/predictions` sem versão (404).
 * O cliente `replicate` usa esse path quando o ref é só `owner/name`. Com digest,
 * usa `POST /v1/predictions` + `version`. Resolvemos `latest_version.id` quando falta digest.
 */
export async function resolveVisionModelRunRef(
  replicate: Replicate,
  ref: string,
): Promise<VisionModelRunRef> {
  const trimmed = ref.trim();
  if (trimmed.includes(":")) {
    return trimmed as VisionModelRunRef;
  }
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    throw new Error(
      `REPLICATE_VISION_MODEL inválido: "${trimmed}". Use o formato dono/nome ou dono/nome:versão.`,
    );
  }
  const owner = trimmed.slice(0, slash);
  const name = trimmed.slice(slash + 1);
  if (!owner || !name || name.includes("/")) {
    throw new Error(
      `REPLICATE_VISION_MODEL inválido: "${trimmed}". Use o formato dono/nome ou dono/nome:versão.`,
    );
  }
  const model = await replicate.models.get(owner, name);
  const versionId = model.latest_version?.id;
  if (!versionId) {
    throw new Error(`Modelo ${owner}/${name} sem versão publicada na Replicate.`);
  }
  return `${owner}/${name}:${versionId}` as VisionModelRunRef;
}
