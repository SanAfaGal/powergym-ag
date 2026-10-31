import { test } from "node:test";
import assert from "node:assert/strict";
import { createSharedResource } from "./sharedResource.ts";

function setup(options: { failFirst?: boolean } = {}) {
  let created = 0;
  const disposed: number[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  const resource = createSharedResource<number>({
    create: async () => {
      created += 1;
      if (options.failFirst && created === 1) throw new Error("boom");
      return created;
    },
    dispose: (v) => {
      disposed.push(v);
    },
    idleMs: 1000,
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
  });
  const fire = () => timers.filter((t) => !t.cleared).forEach((t) => t.fn());
  return { resource, timers, disposed, fire, created: () => created };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("the resource is created once and shared by every acquirer", async () => {
  const { resource, created } = setup();
  const [a, b] = await Promise.all([resource.acquire(), resource.acquire()]);
  assert.equal(a, b);
  assert.equal(created(), 1);
});

test("while someone still holds it, it is never disposed", async () => {
  const { resource, timers } = setup();
  await resource.acquire();
  await resource.acquire();
  resource.release();
  assert.equal(timers.length, 0);
});

test("once nobody holds it, it is disposed only after the idle time", async () => {
  const { resource, timers, disposed, fire } = setup();
  await resource.acquire();
  resource.release();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 1000);
  assert.deepEqual(disposed, []);
  fire();
  await tick();
  assert.deepEqual(disposed, [1]);
});

test("coming back within the idle time keeps the loaded resource (no reload)", async () => {
  const { resource, disposed, fire, created } = setup();
  const first = await resource.acquire();
  resource.release();
  const again = await resource.acquire();
  fire();
  await tick();
  assert.equal(again, first);
  assert.equal(created(), 1);
  assert.deepEqual(disposed, []);
});

test("after it was disposed a new acquire loads a fresh one", async () => {
  const { resource, fire, created } = setup();
  await resource.acquire();
  resource.release();
  fire();
  await tick();
  assert.equal(await resource.acquire(), 2);
  assert.equal(created(), 2);
});

test("a failed load is not cached: the next acquire tries again", async () => {
  const { resource, created } = setup({ failFirst: true });
  await assert.rejects(resource.acquire(), /boom/);
  resource.release();
  assert.equal(await resource.acquire(), 2);
  assert.equal(created(), 2);
});

test("releasing more than acquired does not break the count", async () => {
  const { resource, timers } = setup();
  await resource.acquire();
  resource.release();
  resource.release();
  assert.equal(timers.length, 1);
});
