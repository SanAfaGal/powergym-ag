import { test } from "node:test";
import assert from "node:assert/strict";
import { pickChallenge } from "./challengePicker.ts";

const pool = ["blink", "smile", "open_mouth", "turn_any"] as const;

test("it never repeats the previous challenge when there is a choice", () => {
  for (const last of pool) {
    for (let i = 0; i < 50; i++) {
      assert.notEqual(pickChallenge([...pool], last), last);
    }
  }
});

test("it can return every challenge other than the last one", () => {
  const seen = new Set<string>();
  for (let i = 0; i < pool.length - 1; i++) {
    seen.add(pickChallenge([...pool], "blink", () => i / (pool.length - 1)));
  }
  assert.deepEqual([...seen].sort(), ["open_mouth", "smile", "turn_any"]);
});

test("with a single challenge it returns that one even if it was the last", () => {
  assert.equal(pickChallenge(["blink"], "blink"), "blink");
});

test("with no previous challenge any of the pool can come up", () => {
  assert.equal(pickChallenge([...pool], null, () => 0), "blink");
  assert.equal(pickChallenge([...pool], null, () => 0.99), "turn_any");
});

test("an empty pool is a programming error", () => {
  assert.throws(() => pickChallenge([], null), /empty/);
});
