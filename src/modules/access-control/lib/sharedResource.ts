// A heavy resource (the recognition model, the face detector) shared by every
// screen that needs it, so moving between modules does not reload it. It is
// created on first use, kept while anything holds it, and disposed only after
// it has gone unused for `idleMs`, so a weak device is not left holding
// hundreds of MB forever. A failed load is never cached.
export function createSharedResource<T>(options: {
  create: () => Promise<T>;
  dispose: (value: T) => void | Promise<void>;
  idleMs: number;
  // injectable for tests
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): { acquire(): Promise<T>; release(): void } {
  const setTimer =
    options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let promise: Promise<T> | null = null;
  let holders = 0;
  let idleTimer: unknown = null;

  return {
    acquire() {
      holders += 1;
      if (idleTimer !== null) {
        clearTimer(idleTimer);
        idleTimer = null;
      }
      if (!promise) {
        const created = options.create();
        promise = created;
        created.catch(() => {
          if (promise === created) promise = null;
        });
      }
      return promise;
    },

    release() {
      if (holders === 0) return;
      holders -= 1;
      if (holders > 0 || idleTimer !== null) return;
      idleTimer = setTimer(() => {
        idleTimer = null;
        if (holders > 0 || !promise) return;
        const old = promise;
        promise = null;
        old.then((value) => options.dispose(value)).catch(() => {});
      }, options.idleMs);
    },
  };
}
