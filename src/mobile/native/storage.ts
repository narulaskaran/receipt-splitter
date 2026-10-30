import { Preferences } from "@capacitor/preferences";

import {
  STORAGE_MIRROR_PREFIX,
  setStorageMirror,
  type StorageMirror,
} from "@/lib/storage";

type MirrorOp =
  | { type: "set"; value: string }
  | { type: "remove" };

const pending = new Map<string, MirrorOp>();
const inflight = new Map<string, Promise<void>>();

function warnPreferences(op: MirrorOp["type"], key: string, error: unknown): void {
  console.warn(`Preferences ${op} failed for "${key}"`, error);
}

async function drain(key: string): Promise<void> {
  while (pending.has(key)) {
    const op = pending.get(key);
    pending.delete(key);
    if (!op) continue;
    try {
      if (op.type === "set") {
        await Preferences.set({ key, value: op.value });
      } else {
        await Preferences.remove({ key });
      }
    } catch (error) {
      warnPreferences(op.type, key, error);
    }
  }
}

function enqueue(key: string, op: MirrorOp): void {
  pending.set(key, op);
  if (inflight.has(key)) return;
  const job = drain(key);
  inflight.set(key, job);
  void job.finally(() => {
    if (inflight.get(key) === job) inflight.delete(key);
  });
}

const preferencesMirror: StorageMirror = {
  set(key, value) {
    enqueue(key, { type: "set", value });
  },
  remove(key) {
    enqueue(key, { type: "remove" });
  },
};

/** Wait until queued Preferences writes have finished. Last write per key wins. */
export async function flush(): Promise<void> {
  for (;;) {
    const jobs = [...inflight.values()];
    if (jobs.length === 0) return;
    await Promise.all(jobs);
  }
}

function isMirroredKey(key: string): boolean {
  return key.startsWith(STORAGE_MIRROR_PREFIX);
}

/**
 * Preferences wins over WebView localStorage (the WebView can evict it).
 * Prefixed keys that exist only in localStorage are copied up once.
 * If this throws, the write-through mirror is not installed.
 */
export async function hydrateStorageFromPreferences(): Promise<void> {
  try {
    const listed = await Preferences.keys();
    const native = new Map<string, string>();
    for (const key of listed.keys) {
      if (!isMirroredKey(key)) continue;
      const stored = await Preferences.get({ key });
      if (stored.value === null) continue;
      native.set(key, stored.value);
    }

    for (const [key, value] of native) {
      localStorage.setItem(key, value);
    }

    const localOnly: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isMirroredKey(key) || native.has(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) localOnly.push([key, value]);
    }
    for (const [key, value] of localOnly) {
      await Preferences.set({ key, value });
    }

    setStorageMirror(preferencesMirror);
  } catch (error) {
    console.warn(
      "Native storage hydration failed; continuing with localStorage only and not mirroring writes.",
      error,
    );
  }
}
