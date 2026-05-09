import { resolveVisionModelRunRef } from "@/lib/replicate/resolve-vision-model-run-ref";
import Replicate from "replicate";

/** LLaVA 13B por defeito; alternativa: lucataco/moondream2 (slug; digest resolvido em runtime). */
const DEFAULT_VISION_MODEL = "yorickvp/llava-13b";

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("Defina REPLICATE_API_TOKEN para executar a análise por visão.");
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

  const isMoondream = modelRef.toLowerCase().includes("moondream");
  const input: Record<string, string | number> = {
    image: imageUrl,
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
