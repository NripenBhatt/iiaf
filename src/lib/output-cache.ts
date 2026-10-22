import { z } from "zod";
import { generatedOutputSchema } from "./output-contract";

export const storedOutputSetSchema = z.object({ outputs: generatedOutputSchema.array(), skipped: z.array(z.object({ name: z.string(), reason: z.string() })).default([]), limitations: z.string().array().default([]), segmentCount: z.number().default(0) });

/** The losing request must never claim its unsaved body is the persisted cache winner. */
export function confirmedCacheWinner(expected: unknown, winner: { outputs: unknown; source_version: string; created_at: string } | null, version: string) {
  if (!winner) throw new Error("Saved output winner could not be read; no cached result was returned.");
  const saved = storedOutputSetSchema.parse(winner.outputs);
  if (winner.source_version !== version || JSON.stringify(saved) !== JSON.stringify(storedOutputSetSchema.parse(expected))) throw new Error("Saved outputs conflict with this source result; no unsaved result was returned.");
  return { ...saved, sourceVersion: winner.source_version, createdAt: winner.created_at, cached: true as const };
}