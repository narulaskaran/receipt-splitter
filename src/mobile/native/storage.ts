import { Preferences } from "@capacitor/preferences";

import {
  MAX_PREFERENCES_VALUE_LENGTH,
  isMirroredDataKey,
  reportDurableStorageUnavailable,
  safeGetItem,
  setStorageMirror,
  type StorageMirror,
} from "@/lib/storage";

/** Reading everything from Preferences at boot must not hold up the first render. */
export const HYDRATION_TIMEOUT_MS = 5_000;

// Newest pending value per key (null = remove). Writes to one key run one at
// a time, so the last write wins.
const queued = new Map<string, string | null>();
const running = new Set<string>();
const jobs = new Set<Promise<void>>();

async function drain(key: string): Promise<void> {
  try {
    while (queued.has(key)) {
      const value = queued.get(key) ?? null;
      queued.delete(key);
      try {
        if (value === null) {
          await Preferences.remove({ key });
        } else if (value.length > MAX_PREFERENCES_VALUE_LENGTH) {
          console.warn(
            `Skipping Preferences write for "${key}": ${value.length} chars exceeds ${MAX_PREFERENCES_VALUE_LENGTH}. The value stays in on-device storage.`,
          );
        } else {
          await Preferences.set({ key, value });
        }
      } catch (error) {
        // The next write to this key (or the next boot) pushes the value again.
        console.warn(`Preferences write failed for "${key}"`, error);
      }
    }
  } finally {
    running.delete(key);
  }
}

function enqueue(key: string, value: string | null): void {
  queued.set(key, value);
  if (running.has(key)) return;
  running.add(key);
  const job = drain(key);
  jobs.add(job);
  void job.finally(() => jobs.delete(job));
}

const preferencesMirror: StorageMirror = {
  set: (key, value) => enqueue(key, value),
  remove: (key) => enqueue(key, null),
};

/** Wait until queued Preferences writes have finished. */
export async function flush(): Promise<void> {
  while (jobs.size > 0) await Promise.all(jobs);
}

async function readPreferences(): Promise<Map<string, string>> {
  const { keys } = await Preferences.keys();
  const entries = await Promise.all(
    keys.filter(isMirroredDataKey).map(async (key) => {
      const { value } = await Preferences.get({ key });
      return [key, value] as const;
    }),
  );
  const values = new Map<string, string>();
  for (const [key, value] of entries) if (value !== null) values.set(key, value);
  return values;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preferences timed out")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Make Preferences a write-through backup of localStorage. iOS can evict the
 * WebView's localStorage; Preferences survives, so at boot it fills in any
 * key localStorage no longer has. A key localStorage still has wins (it is
 * what the app was last using), and local-only keys are copied up, which also
 * adopts data saved before the mirror existed.
 *
 * If Preferences fails or hangs, localStorage is left alone, no mirror is
 * installed, and the app shows a one-time notice.
 */
export async function hydrateStorageFromPreferences(): Promise<void> {
  setStorageMirror(null);
  let stored: Map<string, string>;
  try {
    stored = await withTimeout(readPreferences(), HYDRATION_TIMEOUT_MS);
  } catch (error) {
    console.warn(
      "Native storage hydration failed; continuing with localStorage only and not mirroring writes.",
      error,
    );
    reportDurableStorageUnavailable(error);
    return;
  }

  for (const [key, value] of stored) {
    if (safeGetItem(key) !== null) continue;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Could not restore "${key}" from Preferences`, error);
    }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = key && isMirroredDataKey(key) ? localStorage.getItem(key) : null;
      if (key && value !== null && stored.get(key) !== value) enqueue(key, value);
    }
  } catch (error) {
    console.warn("Could not copy localStorage to Preferences", error);
  }
  setStorageMirror(preferencesMirror);
}

/** Test hook: drop queued writes left behind by a failed case. */
export function resetPreferencesQueueForTests(): void {
  queued.clear();
  running.clear();
  jobs.clear();
}
