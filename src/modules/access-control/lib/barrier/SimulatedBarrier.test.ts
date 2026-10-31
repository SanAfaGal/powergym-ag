import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulatedBarrier } from "./SimulatedBarrier.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a new barrier is locked", () => {
  assert.equal(new SimulatedBarrier({ openMs: 20 }).state, "locked");
});

test("open() opens the barrier and it locks itself again after openMs", async () => {
  const barrier = new SimulatedBarrier({ openMs: 30 });
  await barrier.open();
  assert.equal(barrier.state, "open");
  await sleep(80);
  assert.equal(barrier.state, "locked");
});

test("subscribers see open then locked, and stop after unsubscribing", async () => {
  const barrier = new SimulatedBarrier({ openMs: 20 });
  const seen: string[] = [];
  const unsubscribe = barrier.subscribe((s) => seen.push(s));
  await barrier.open();
  await sleep(60);
  assert.deepEqual(seen, ["open", "locked"]);

  unsubscribe();
  await barrier.open();
  await sleep(60);
  assert.deepEqual(seen, ["open", "locked"]);
});

test("opening again while open restarts the timer instead of stacking", async () => {
  const barrier = new SimulatedBarrier({ openMs: 50 });
  const seen: string[] = [];
  barrier.subscribe((s) => seen.push(s));
  await barrier.open();
  await sleep(30);
  await barrier.open();
  await sleep(30);
  assert.equal(barrier.state, "open");
  await sleep(60);
  assert.deepEqual(seen, ["open", "locked"]);
});
