// Fires once after `required` consecutive good frames, so a single lucky
// frame (a passer-by, a half-turned head) never triggers an attempt. After
// firing, the full streak has to be rebuilt.
export function createStabilityTracker(required: number): {
  push(ok: boolean): boolean;
  reset(): void;
} {
  let streak = 0;
  return {
    push(ok) {
      if (!ok) {
        streak = 0;
        return false;
      }
      streak += 1;
      if (streak >= required) {
        streak = 0;
        return true;
      }
      return false;
    },
    reset() {
      streak = 0;
    },
  };
}
