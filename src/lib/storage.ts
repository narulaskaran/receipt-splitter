export const RECEIPT_IMAGE_STORAGE_KEY = "receiptSplitterImage";

/** Keys with this prefix are copied to the native Preferences mirror when one is installed. */
export const STORAGE_MIRROR_PREFIX = "receiptSplitter";

/**
 * Revision sidecar stored in both localStorage and Preferences.
 * Not a data key: it is written directly so a revision bump cannot recurse.
 */
export const MIRROR_META_STORAGE_KEY = "receiptSplitter__meta";

/**
 * Failed Preferences operations, persisted in localStorage so the next write,
 * foreground flush, or boot can retry them. Not copied up as a data key.
 */
export const MIRROR_PENDING_STORAGE_KEY = "receiptSplitter__pending";

/**
 * iOS UserDefaults (what Capacitor Preferences uses) is not a blob store.
 * Values larger than this are kept in localStorage only. A full thumbnail map
 * stays well under the cap; a legacy full-size receipt image does not.
 */
export const MAX_PREFERENCES_VALUE_LENGTH = 1_000_000;

/**
 * Optional write-through used by the iOS shell. Web never installs one.
 * `set` / `remove` run after the localStorage attempt, including when that
 * attempt throws, so Preferences can keep a copy the WebView evicted.
 */
export interface StorageMirror {
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface MirrorKeyMeta {
  rev: number;
  updatedAt: number;
  /** Latest revision removed the key. A newer tombstone must not be overwritten. */
  deleted?: boolean;
}

export interface MirrorMetaFile {
  v: 1;
  updatedAt: number;
  keys: Record<string, MirrorKeyMeta>;
}

export interface PendingMirrorOp {
  key: string;
  op: "set" | "remove";
  value?: string;
  rev: number;
  updatedAt: number;
}

export interface MirrorSnapshot {
  values: ReadonlyMap<string, string>;
  meta: MirrorMetaFile | null;
}

export interface MirrorReconciliation {
  /** null deletes the local key. */
  local: Array<{ key: string; value: string | null }>;
  /** null deletes the Preferences key. */
  remote: Array<{ key: string; value: string | null }>;
  meta: MirrorMetaFile;
}

let storageMirror: StorageMirror | null = null;

/**
 * Values Preferences restored that localStorage refused (quota / security).
 * `null` is an in-memory tombstone so a failed remove cannot be read back.
 */
const memoryOverlay = new Map<string, string | null>();

let hydrationGuard: { token: number; dirty: Set<string> } | null = null;
let durableStorageNoticePending = false;

const DURABLE_STORAGE_NOTICE =
  "Backup storage on this device is unavailable. This session still uses on-device storage.";

export function setStorageMirror(mirror: StorageMirror | null): void {
  storageMirror = mirror;
}

export function isMirroredDataKey(key: string): boolean {
  return (
    key.startsWith(STORAGE_MIRROR_PREFIX) &&
    key !== MIRROR_META_STORAGE_KEY &&
    key !== MIRROR_PENDING_STORAGE_KEY
  );
}

export function beginHydrationGuard(token: number): void {
  hydrationGuard = { token, dirty: new Set() };
}

export function endHydrationGuard(token: number): void {
  if (hydrationGuard?.token === token) hydrationGuard = null;
}

export function hydrationDirtyKeys(token: number): Set<string> {
  if (!hydrationGuard || hydrationGuard.token !== token) return new Set();
  return hydrationGuard.dirty;
}

function noteHydrationWrite(key: string): void {
  if (!hydrationGuard || !isMirroredDataKey(key)) return;
  hydrationGuard.dirty.add(key);
}

export function rememberMirroredValue(key: string, value: string | null): void {
  memoryOverlay.set(key, value);
}

export function forgetMirroredValue(key: string): void {
  memoryOverlay.delete(key);
}

/**
 * One-time, non-blocking signal that Preferences could not be used.
 * Boot logs immediately; the shell shows the message after the first paint.
 */
export function reportDurableStorageUnavailable(detail?: unknown): void {
  console.warn(
    "Durable storage is unavailable; continuing with on-device storage only.",
    detail ?? "",
  );
  durableStorageNoticePending = true;
}

export function consumeDurableStorageNotice(): string | null {
  if (!durableStorageNoticePending) return null;
  durableStorageNoticePending = false;
  return DURABLE_STORAGE_NOTICE;
}

/** Clears in-memory mirror state so tests do not leak into the next case. */
export function resetEphemeralStorageForTests(): void {
  memoryOverlay.clear();
  hydrationGuard = null;
  durableStorageNoticePending = false;
  storageMirror = null;
}

function notifyMirror(key: string, op: "set" | "remove", value?: string): void {
  if (!storageMirror || !isMirroredDataKey(key)) return;
  try {
    if (op === "set") storageMirror.set(key, value ?? "");
    else storageMirror.remove(key);
  } catch (err) {
    console.warn(`Storage mirror ${op} failed for key "${key}"`, err);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMirrorMeta(raw: string | null): MirrorMetaFile | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1 || !isRecord(parsed.keys)) return null;
    const keys: Record<string, MirrorKeyMeta> = {};
    for (const [key, value] of Object.entries(parsed.keys)) {
      if (!isMirroredDataKey(key) || !isRecord(value)) continue;
      if (typeof value.rev !== "number" || !Number.isFinite(value.rev)) continue;
      if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) continue;
      const entry: MirrorKeyMeta = { rev: value.rev, updatedAt: value.updatedAt };
      if (value.deleted === true) entry.deleted = true;
      keys[key] = entry;
    }
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;
    return { v: 1, updatedAt, keys };
  } catch {
    return null;
  }
}

export function loadMirrorMeta(): MirrorMetaFile | null {
  return parseMirrorMeta(safeGetItem(MIRROR_META_STORAGE_KEY));
}

export function emptyMirrorMeta(): MirrorMetaFile {
  return { v: 1, updatedAt: 0, keys: {} };
}

/** Write the sidecar locally and, when a mirror is installed, push that blob too. */
export function persistMirrorMeta(meta: MirrorMetaFile): void {
  const json = JSON.stringify(meta);
  try {
    localStorage.setItem(MIRROR_META_STORAGE_KEY, json);
    forgetMirroredValue(MIRROR_META_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not persist storage mirror metadata", error);
    rememberMirroredValue(MIRROR_META_STORAGE_KEY, json);
  }
  if (!storageMirror) return;
  try {
    storageMirror.set(MIRROR_META_STORAGE_KEY, json);
  } catch (error) {
    console.warn("Storage mirror set failed for metadata", error);
  }
}

function commitLocalRevision(key: string, deleted: boolean): MirrorKeyMeta {
  const meta = loadMirrorMeta() ?? emptyMirrorMeta();
  const prev = meta.keys[key];
  const next: MirrorKeyMeta = {
    rev: (prev?.rev ?? 0) + 1,
    updatedAt: Date.now(),
  };
  if (deleted) next.deleted = true;
  meta.keys[key] = next;
  meta.updatedAt = next.updatedAt;
  persistMirrorMeta(meta);
  return next;
}

export function readPendingMirrorOps(): PendingMirrorOp[] {
  const raw = safeGetItem(MIRROR_PENDING_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ops: PendingMirrorOp[] = [];
    for (const entry of parsed) {
      if (!isRecord(entry) || typeof entry.key !== "string") continue;
      if (entry.op !== "set" && entry.op !== "remove") continue;
      if (typeof entry.rev !== "number" || typeof entry.updatedAt !== "number") continue;
      const op: PendingMirrorOp = {
        key: entry.key,
        op: entry.op,
        rev: entry.rev,
        updatedAt: entry.updatedAt,
      };
      if (entry.op === "set" && typeof entry.value === "string") op.value = entry.value;
      if (entry.op === "set" && op.value === undefined) continue;
      ops.push(op);
    }
    return ops;
  } catch {
    return [];
  }
}

export function writePendingMirrorOps(ops: readonly PendingMirrorOp[]): void {
  try {
    if (ops.length === 0) {
      localStorage.removeItem(MIRROR_PENDING_STORAGE_KEY);
      forgetMirroredValue(MIRROR_PENDING_STORAGE_KEY);
      return;
    }
    const json = JSON.stringify(ops);
    localStorage.setItem(MIRROR_PENDING_STORAGE_KEY, json);
    forgetMirroredValue(MIRROR_PENDING_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not persist pending storage mirror operations", error);
  }
}

function rank(meta: MirrorKeyMeta | null): { rev: number; updatedAt: number } {
  if (!meta) return { rev: 0, updatedAt: 0 };
  return { rev: meta.rev, updatedAt: meta.updatedAt };
}

function compareMeta(
  nativeMeta: MirrorKeyMeta | null,
  localMeta: MirrorKeyMeta | null,
): "native" | "local" | "tie" {
  const native = rank(nativeMeta);
  const local = rank(localMeta);
  if (native.rev !== local.rev) return native.rev > local.rev ? "native" : "local";
  if (native.updatedAt !== local.updatedAt) {
    return native.updatedAt > local.updatedAt ? "native" : "local";
  }
  return "tie";
}

function revisionForDirty(
  existing: MirrorKeyMeta | null,
  nativeRev: number,
  deleted: boolean,
): MirrorKeyMeta {
  const alreadyNewer =
    existing !== null &&
    existing.rev > nativeRev &&
    (existing.deleted === true) === deleted;
  if (alreadyNewer && existing) return existing;
  const next: MirrorKeyMeta = {
    rev: Math.max(existing?.rev ?? 0, nativeRev) + 1,
    updatedAt: Date.now(),
  };
  if (deleted) next.deleted = true;
  return next;
}

/**
 * Pick a winner per key.
 *
 * No metadata on either side keeps the original rule: Preferences overwrites
 * a conflicting local value, and a local-only value is copied up.
 * Otherwise the newer revision wins. Equal revisions are a tie: Preferences
 * wins only when localStorage has no value and no tombstone.
 */
export function reconcileMirroredStores(
  native: MirrorSnapshot,
  local: MirrorSnapshot,
  dirty: ReadonlySet<string> = new Set(),
): MirrorReconciliation {
  const keys = new Set<string>([
    ...native.values.keys(),
    ...local.values.keys(),
    ...Object.keys(native.meta?.keys ?? {}),
    ...Object.keys(local.meta?.keys ?? {}),
  ]);

  const localOps: Array<{ key: string; value: string | null }> = [];
  const remoteOps: Array<{ key: string; value: string | null }> = [];
  const merged: MirrorMetaFile = {
    v: 1,
    updatedAt: Math.max(native.meta?.updatedAt ?? 0, local.meta?.updatedAt ?? 0),
    keys: {},
  };

  for (const key of keys) {
    if (!isMirroredDataKey(key)) continue;
    const nativeMeta = native.meta?.keys[key] ?? null;
    const localMeta = local.meta?.keys[key] ?? null;
    const nativeValue = native.values.has(key) ? native.values.get(key)! : undefined;
    const localValue = local.values.has(key) ? local.values.get(key)! : undefined;

    if (dirty.has(key)) {
      const deleted = localValue === undefined || localMeta?.deleted === true;
      const next = revisionForDirty(localMeta, nativeMeta?.rev ?? 0, deleted);
      merged.keys[key] = next;
      if (deleted) {
        if (localValue !== undefined) localOps.push({ key, value: null });
        if (nativeValue !== undefined) remoteOps.push({ key, value: null });
      } else if (nativeValue !== localValue) {
        remoteOps.push({ key, value: localValue! });
      }
      continue;
    }

    if (!nativeMeta && !localMeta) {
      if (nativeValue !== undefined && (localValue === undefined || nativeValue !== localValue)) {
        localOps.push({ key, value: nativeValue });
      } else if (nativeValue === undefined && localValue !== undefined) {
        remoteOps.push({ key, value: localValue });
      }
      continue;
    }

    const winner = compareMeta(nativeMeta, localMeta);
    const preferNative =
      winner === "native" ||
      (winner === "tie" && localValue === undefined && localMeta?.deleted !== true);
    if (preferNative) {
      if (nativeMeta?.deleted === true) {
        if (localValue !== undefined) localOps.push({ key, value: null });
        if (nativeValue !== undefined) remoteOps.push({ key, value: null });
        if (nativeMeta) merged.keys[key] = nativeMeta;
        continue;
      }
      if (nativeValue === undefined) {
        // Newer metadata but no value and no tombstone: do not wipe a local copy.
        if (localValue !== undefined) {
          remoteOps.push({ key, value: localValue });
          if (localMeta) merged.keys[key] = localMeta;
        }
        continue;
      }
      if (localValue !== nativeValue) localOps.push({ key, value: nativeValue });
      if (nativeMeta) merged.keys[key] = nativeMeta;
      continue;
    }

    if (localMeta?.deleted === true || localValue === undefined) {
      if (localValue !== undefined) localOps.push({ key, value: null });
      if (nativeValue !== undefined) remoteOps.push({ key, value: null });
      if (localMeta) merged.keys[key] = localMeta;
      continue;
    }
    if (nativeValue !== localValue) remoteOps.push({ key, value: localValue });
    if (localMeta) merged.keys[key] = localMeta;
  }

  for (const entry of Object.values(merged.keys)) {
    if (entry.updatedAt > merged.updatedAt) merged.updatedAt = entry.updatedAt;
  }
  return { local: localOps, remote: remoteOps, meta: merged };
}

export function collectLocalMirrorSnapshot(): MirrorSnapshot {
  const values = new Map<string, string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isMirroredDataKey(key)) continue;
      const value = readLocalOnly(key);
      if (value !== null) values.set(key, value);
    }
  } catch (error) {
    console.warn("Could not list localStorage for mirror reconciliation", error);
  }
  for (const [key, value] of memoryOverlay) {
    if (!isMirroredDataKey(key)) continue;
    if (value === null) values.delete(key);
    else values.set(key, value);
  }
  return { values, meta: loadMirrorMeta() };
}

function readLocalOnly(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe localStorage wrapper that handles QuotaExceededError.
 * Returns true on success, false on failure (logs the error to console).
 *
 * Real-world localStorage limits:
 *   - iOS Safari:           5 MB (smallest in common use)
 *   - Safari (desktop):     5 MB (some newer versions up to 10 MB)
 *   - Chrome (desktop):    10 MB
 *   - Firefox:             10 MB
 *   - Chrome Android:      10 MB (varies by device RAM)
 *   - Samsung Internet:    10 MB
 *
 * This app's main consumer is the cached receipt image stored as a base64
 * data URL. With a 4 MB compression target, the base64-encoded string is
 * ~5.3 MB (33% overhead), which can exceed the 5 MB limit on Safari.
 * The safeSetItem wrapper catches that case and the caller can fall back
 * to evicting the image cache.
 */
export function safeSetItem(key: string, value: string): boolean {
  noteHydrationWrite(key);
  let stored = false;
  try {
    localStorage.setItem(key, value);
    stored = true;
    forgetMirroredValue(key);
  } catch (err) {
    const usage = measureStorageUsage();
    console.warn(
      `localStorage.setItem failed for key "${key}"` +
        ` (current usage: ~${formatBytes(usage)})`,
      err,
    );
    stored = false;
    if (isMirroredDataKey(key)) rememberMirroredValue(key, value);
  }
  if (storageMirror && isMirroredDataKey(key)) commitLocalRevision(key, false);
  notifyMirror(key, "set", value);
  return stored;
}

/**
 * Safe localStorage.getItem wrapper.
 * Mirrored keys that could not be written during hydration are served from
 * the in-memory overlay first, including a tombstone (`null`).
 * Returns null on any error, or the stored value on success.
 */
export function safeGetItem(key: string): string | null {
  if (memoryOverlay.has(key)) return memoryOverlay.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  noteHydrationWrite(key);
  let removed = false;
  try {
    localStorage.removeItem(key);
    removed = true;
    forgetMirroredValue(key);
  } catch {
    removed = false;
    if (isMirroredDataKey(key)) rememberMirroredValue(key, null);
  }
  if (storageMirror && isMirroredDataKey(key)) commitLocalRevision(key, true);
  notifyMirror(key, "remove");
  return removed;
}

/**
 * Remove on-device split data: session, thumbnails, legacy image, AI consent,
 * and the anonymous session id. Theme is left alone. When the Preferences
 * mirror is installed, each removal is tombstoned and mirrored so a later
 * boot cannot restore what was cleared.
 */
export function clearAllLocalData(): void {
  const keys = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isMirroredDataKey(key)) keys.add(key);
    }
  } catch (error) {
    console.warn("Could not list local data to clear", error);
  }
  for (const key of memoryOverlay.keys()) {
    if (isMirroredDataKey(key)) keys.add(key);
  }
  for (const key of keys) safeRemoveItem(key);
}

/**
 * Returns the approximate total bytes used by all keys and values in
 * localStorage. Each character is counted as 2 bytes (UTF-16), which
 * matches the ECMAScript specification for string storage and is the
 * metric browsers use for quota accounting.
 *
 * Use this to get a rough picture of storage pressure — for example, to
 * decide whether to pre-emptively evict the cached receipt image.
 */
export function measureStorageUsage(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Each JS string character is 2 bytes (UTF-16)
        total += key.length * 2;
        const value = localStorage.getItem(key);
        if (value) {
          total += value.length * 2;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Format a byte count to a human-readable string (B, KB, or MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
