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
  // guid, not uuid: z.uuid() enforces RFC version/variant bits, which the
  // seeded local clients (e.g. 20000000-0000-0000-0000-000000000002) lack.
  clientId: z.guid(),
  embeddings: z.array(embeddingSchema).length(3),
  quality: z.number().min(0).max(1),
  consentTextVersion: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
});
export type EnrollInput = z.infer<typeof enrollSchema>;

export const LIVENESS_CHALLENGES = [
  "blink",
  "open_mouth",
  "smile",
  "turn_any",
] as const;

export const settingsSchema = z
  .object({
    matchThreshold: z.number().min(0).max(1),
    livenessRequired: z.boolean(),
    livenessChallenges: z.array(z.enum(LIVENESS_CHALLENGES)),
    // minutes before a client who was just let in can be let in again (0 = off)
    readmitCooldownMinutes: z.number().int().min(0).max(60),
  })
  .refine((v) => !v.livenessRequired || v.livenessChallenges.length > 0, {
    message: "Elegí al menos una prueba de vida",
    path: ["livenessChallenges"],
  });
export type SettingsInput = z.infer<typeof settingsSchema>;
