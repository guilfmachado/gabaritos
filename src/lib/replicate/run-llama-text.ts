import { throwMissingEnv } from "@/lib/env/missing-env-log";
import { resolveVisionModelRunRef } from "@/lib/replicate/resolve-vision-model-run-ref";
import Replicate from "replicate";

const DEFAULT_TEXT_MODEL = "meta/meta-llama-3-8b-instruct";
const DEFAULT_AUDIT_MODEL = "meta/meta-llama-3-70b-instruct";

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throwMissingEnv(
      "REPLICATE_API_TOKEN",
      "Token só no servidor (API Route / Server Action); nunca no browser.",
    );
  }
  return new Replicate({ auth: token });
}

/** Texto puro via modelo instrutivo na Replicate (ex.: Llama 3 8B). */
export async function runLlamaTextPrompt(prompt: string, maxTokens = 768): Promise<string> {
  const replicate = getReplicate();
  const ref = process.env.REPLICATE_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
  const model = await resolveVisionModelRunRef(replicate, ref);

  const output: unknown = await replicate.run(model, {
    input: {
      prompt,
      max_tokens: maxTokens,
      temperature: 0.45,
    },
  });

  if (typeof output === "string") return output.trim();
  if (Array.isArray(output)) return output.map(String).join("").trim();
  return String(output ?? "").trim();
}

/** Llama 3 70B — auditoria jurídica pós-visão (ou otimização premium). */
export async function runLlamaAuditPrompt(prompt: string, maxTokens = 4096): Promise<string> {
  const replicate = getReplicate();
  const ref = process.env.REPLICATE_AUDIT_MODEL?.trim() || DEFAULT_AUDIT_MODEL;
  const model = await resolveVisionModelRunRef(replicate, ref);

  const output: unknown = await replicate.run(model, {
    input: {
      prompt,
      max_tokens: maxTokens,
      temperature: 0.35,
    },
  });

  if (typeof output === "string") return output.trim();
  if (Array.isArray(output)) return output.map(String).join("").trim();
  return String(output ?? "").trim();
}
