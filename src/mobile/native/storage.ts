import { Preferences } from "@capacitor/preferences";

import {
  MAX_PREFERENCES_VALUE_LENGTH,
  MIRROR_META_STORAGE_KEY,
  beginHydrationGuard,
  collectLocalMirrorSnapshot,
  endHydrationGuard,
  forgetMirroredValue,
  hydrationDirtyKeys,
  isMirroredDataKey,
  loadMirrorMeta,
  parseMirrorMeta,
  persistMirrorMeta,
  readPendingMirrorOps,
  reconcileMirroredStores,
  rememberMirroredValue,
  reportDurableStorageUnavailable,
  setStorageMirror,
  writePendingMirrorOps,
  type PendingMirrorOp,
  type StorageMirror,
} from "@/lib/storage";

/** Whole Preferences hydration, including every read. */
export const HYDRATION_TIMEOUT_MS = 5_000;

/** Each Preferences call is bounded, and also by whatever budget remains. */
export const PREFERENCES_OP_TIMEOUT_MS = 4_000;

type MirrorOp = {
  type: "set" | "remove";
  value?: string;
  rev: number;
  updatedAt: number;
};

const queued = new Map<string, MirrorOp>();
const inflight = new Map<string, Promise<void>>();

let hydrationGeneration = 0;
let mirrorActive = false;

function warnPreferences(op: MirrorOp["type"], key: string, error: unknown): void {
  console.warn(`Preferences ${op} failed for "${key}"`, error);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) {
    return Promise.reject(new Error(`Preferences timed out (${label})`));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Preferences timed out (${label})`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function revisionFor(key: string): { rev: number; updatedAt: number } {
  const meta = loadMirrorMeta();
  const entry = meta?.keys[key];
  return { rev: entry?.rev ?? 0, updatedAt: entry?.updatedAt ?? 0 };
}

function persistQueuedAsPending(): void {
  const byKey = new Map<string, PendingMirrorOp>();
  for (const op of readPendingMirrorOps()) byKey.set(op.key, op);
  for (const [key, op] of queued) {
    byKey.set(key, {
      key,
      op: op.type,
      value: op.value,
      rev: op.rev,
      updatedAt: op.updatedAt,
    });
  }
  writePendingMirrorOps([...byKey.values()]);
}

function dropPending(key: string): void {
  const next = readPendingMirrorOps().filter((op) => op.key !== key);
  writePendingMirrorOps(next);
}

async function drain(key: string): Promise<void> {
  while (queued.has(key)) {
    const op = queued.get(key);
    queued.delete(key);
    if (!op) continue;
    if (op.type === "set" && (op.value?.length ?? 0) > MAX_PREFERENCES_VALUE_LENGTH) {
      console.warn(
        `Skipping Preferences write for "${key}": ${op.value?.length ?? 0} chars exceeds ${MAX_PREFERENCES_VALUE_LENGTH}. The value stays in on-device storage.`,
      );
      dropPending(key);
      continue;
    }
    try {
      if (op.type === "set") {
        await Preferences.set({ key, value: op.value ?? "" });
      } else {
        await Preferences.remove({ key });
      }
      if (!queued.has(key)) dropPending(key);
    } catch (error) {
      warnPreferences(op.type, key, error);
      if (!queued.has(key)) {
        const pending = readPendingMirrorOps().filter((entry) => entry.key !== key);
        pending.push({
          key,
          op: op.type,
          value: op.value,
          rev: op.rev,
          updatedAt: op.updatedAt,
        });
        writePendingMirrorOps(pending);
      }
    }
  }
}

function enqueue(key: string, op: MirrorOp): void {
  queued.set(key, op);
  persistQueuedAsPending();
  if (inflight.has(key)) return;
  const job = drain(key);
  inflight.set(key, job);
  void job.finally(() => {
    if (inflight.get(key) === job) inflight.delete(key);
  });
}

function enqueueCurrent(key: string, type: "set" | "remove", value?: string): void {
  const revision = revisionFor(key);
  enqueue(key, { type, value, rev: revision.rev, updatedAt: revision.updatedAt });
}

/**
 * Retry failed mirror operations except `skipKey`, which the caller just
 * replaced with a newer op. Stale entries (revision behind local metadata)
 * are dropped so an old failed write cannot clobber a newer edit.
 */
export function retryPendingMirrorOps(skipKey?: string): void {
  if (!mirrorActive) return;
  const meta = loadMirrorMeta();
  const kept: PendingMirrorOp[] = [];
  for (const op of readPendingMirrorOps()) {
    const localRev = meta?.keys[op.key]?.rev ?? 0;
    if (op.rev < localRev) continue;
    if (op.key === skipKey || queued.has(op.key) || inflight.has(op.key)) {
      kept.push(op);
      continue;
    }
    kept.push(op);
    enqueue(op.key, {
      type: op.op,
      value: op.value,
      rev: op.rev,
      updatedAt: op.updatedAt,
    });
  }
  writePendingMirrorOps(kept);
}

const preferencesMirror: StorageMirror = {
  set(key, value) {
    enqueueCurrent(key, "set", value);
    retryPendingMirrorOps(key);
  },
  remove(key) {
    enqueueCurrent(key, "remove");
    retryPendingMirrorOps(key);
  },
};

/** Wait until queued Preferences writes have finished. Last write per key wins. */
export async function flush(): Promise<void> {
  try {
    retryPendingMirrorOps();
    for (;;) {
      const jobs = [...inflight.values()];
      if (jobs.length === 0) return;
      await Promise.all(jobs);
    }
  } catch (error) {
    console.warn("Preferences flush failed", error);
  }
}

function applyLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    forgetMirroredValue(key);
  } catch (error) {
    console.warn(`localStorage update failed for "${key}" during hydration`, error);
    rememberMirroredValue(key, value);
  }
}

/**
 * Preferences is not unconditionally authoritative. Revisions (and deletion
 * tombstones) in `receiptSplitter__meta` pick the newer copy. Legacy keys
 * with no metadata keep the old rule: Preferences wins when both exist.
 *
 * A hung or failed Preferences *read* fails closed: localStorage is left as
 * it is, the write-through mirror is not installed, and a late result cannot
 * apply after this generation is invalidated.
 *
 * localStorage write failures are per key. The mirror is still installed
 * when the reads succeeded, and `safeGetItem` serves the in-memory copy.
 */
export async function hydrateStorageFromPreferences(): Promise<void> {
  const generation = ++hydrationGeneration;
  const started = Date.now();
  beginHydrationGuard(generation);
  setStorageMirror(null);
  mirrorActive = false;

  let settled = false;
  const timer = setTimeout(() => {
    if (settled || generation !== hydrationGeneration) return;
    hydrationGeneration += 1;
    endHydrationGuard(generation);
    reportDurableStorageUnavailable("hydration timed out");
  }, HYDRATION_TIMEOUT_MS);

  const stale = () => generation !== hydrationGeneration;
  const budget = () =>
    Math.min(PREFERENCES_OP_TIMEOUT_MS, HYDRATION_TIMEOUT_MS - (Date.now() - started));

  try {
    let listed: { keys: string[] };
    try {
      listed = await withTimeout(Preferences.keys(), budget(), "keys");
    } catch (error) {
      if (stale()) return;
      console.warn(
        "Native storage hydration failed; continuing with localStorage only and not mirroring writes.",
        error,
      );
      reportDurableStorageUnavailable(error);
      return;
    }
    if (stale()) return;

    const nativeValues = new Map<string, string>();
    let nativeMetaRaw: string | null = null;
    try {
      for (const key of listed.keys) {
        if (key !== MIRROR_META_STORAGE_KEY && !isMirroredDataKey(key)) continue;
        const stored = await withTimeout(Preferences.get({ key }), budget(), `get ${key}`);
        if (stale()) return;
        if (stored.value === null) continue;
        if (key === MIRROR_META_STORAGE_KEY) nativeMetaRaw = stored.value;
        else nativeValues.set(key, stored.value);
      }
    } catch (error) {
      if (stale()) return;
      console.warn(
        "Native storage hydration failed; continuing with localStorage only and not mirroring writes.",
        error,
      );
      reportDurableStorageUnavailable(error);
      return;
    }
    if (stale()) return;

    // Timer cannot run until this synchronous section returns.
    settled = true;
    clearTimeout(timer);

    const dirty = hydrationDirtyKeys(generation);
    const reconciled = reconcileMirroredStores(
      { values: nativeValues, meta: parseMirrorMeta(nativeMetaRaw) },
      collectLocalMirrorSnapshot(),
      dirty,
    );

    for (const op of reconciled.local) {
      applyLocal(op.key, op.value);
    }
    const mergedJson = JSON.stringify(reconciled.meta);
    const localMetaJson = (() => {
      try {
        return localStorage.getItem(MIRROR_META_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (Object.keys(reconciled.meta.keys).length > 0 && mergedJson !== localMetaJson) {
      persistMirrorMeta(reconciled.meta);
    }

    setStorageMirror(preferencesMirror);
    mirrorActive = true;

    for (const op of reconciled.remote) {
      if (op.value === null) enqueueCurrent(op.key, "remove");
      else enqueueCurrent(op.key, "set", op.value);
    }
    if (
      Object.keys(reconciled.meta.keys).length > 0 &&
      mergedJson !== nativeMetaRaw
    ) {
      enqueue(MIRROR_META_STORAGE_KEY, {
        type: "set",
        value: mergedJson,
        rev: 0,
        updatedAt: reconciled.meta.updatedAt,
      });
    }
    retryPendingMirrorOps();

    const remaining = HYDRATION_TIMEOUT_MS - (Date.now() - started);
    if (remaining > 0 && inflight.size > 0) {
      await Promise.race([
        flush(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, remaining);
        }),
      ]);
    }
  } finally {
    settled = true;
    clearTimeout(timer);
    endHydrationGuard(generation);
  }
}

/** Test hook: drop queued writes left behind by a failed case. */
export function resetPreferencesQueueForTests(): void {
  queued.clear();
  inflight.clear();
  mirrorActive = false;
  hydrationGeneration = 0;
}
