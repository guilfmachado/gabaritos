import { resolvePublicImageUrlForServer } from "@/lib/env/resolve-public-image-url";
import { throwMissingEnv } from "@/lib/env/missing-env-log";
import { resolveVisionModelRunRef } from "@/lib/replicate/resolve-vision-model-run-ref";
import Replicate from "replicate";

/** Alinhado a `analyze-planta.ts` — slug `meta/llama-3.2-11b-vision-instruct` não existe na Replicate (404). */
const DEFAULT_VISION_MODEL = "lucataco/ollama-llama3.2-vision-11b";

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throwMissingEnv(
      "REPLICATE_API_TOKEN",
      "Necessário para modelos na Replicate; configure na Vercel (server only).",
    );
  }
  return new Replicate({ auth: token });
}

export async function runVisionModelWithImageUrl(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const replicate = getReplicate();
  const modelRef = process.env.REPLICATE_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
  const model = await resolveVisionModelRunRef(replicate, modelRef);

  const resolvedImageUrl = resolvePublicImageUrlForServer(imageUrl);

  const isMoondream = modelRef.toLowerCase().includes("moondream");
  const input: Record<string, string | number> = {
    image: resolvedImageUrl,
    prompt,
  };
  if (!isMoondream) {
    input.max_tokens = 4096;
  }

  const output = await replicate.run(model, {
    input,
  });

  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.join("");
  return JSON.stringify(output);
}
