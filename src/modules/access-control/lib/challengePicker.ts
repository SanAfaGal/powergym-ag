import type { LivenessChallenge } from "./liveness.ts";

// Random challenge per attempt, never the same one twice in a row, so a
// recorded answer to "blink" does not work against the next prompt.
export function pickChallenge(
  pool: LivenessChallenge[],
  last: LivenessChallenge | null,
  rand: () => number = Math.random,
): LivenessChallenge {
  if (pool.length === 0) throw new Error("empty challenge pool");
  const options = pool.length > 1 ? pool.filter((c) => c !== last) : pool;
  return options[Math.min(options.length - 1, Math.floor(rand() * options.length))];
}
