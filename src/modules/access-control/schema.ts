import { z } from "zod";
import { isValidEmbedding } from "./lib/embedding.ts";

// z.number() already rejects NaN; the refine adds the 512-d length and the
// non-zero check, so the same rule guards the form side and the server action.
export const embeddingSchema = z
  .array(z.number())
  .refine(isValidEmbedding, { message: "Embedding inválido" });

export const attemptSchema = z.object({
  embedding: embeddingSchema,
  livenessPassed: z.boolean(),
  deviceLabel: z.string().trim().min(1).max(60),
});
export type AttemptInput = z.infer<typeof attemptSchema>;

export const enrollSchema = z.object({
  clientId: z.uuid(),
  embeddings: z.array(embeddingSchema).length(3),
  quality: z.number().min(0).max(1),
  consentTextVersion: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
});
export type EnrollInput = z.infer<typeof enrollSchema>;
