// Caches only the previous service worker (@ducanh2912/next-pwa, a Workbox
// wrapper) created. The new worker doesn't read them, so it deletes them on
// activation. Runtime cache names both workers share (pages, next-image, ...)
// are left alone: they hold the same kinds of responses and the new
// strategies simply reuse them.
export function isLegacyCacheName(name: string): boolean {
  return name.startsWith("workbox-") || name === "start-url";
}

/** Delete the legacy caches. Best effort: a failure must not block activation. */
export async function deleteLegacyCaches(storage: CacheStorage): Promise<void> {
  try {
    const names = await storage.keys();
    await Promise.all(
      names.filter(isLegacyCacheName).map((name) => storage.delete(name)),
    );
  } catch (error) {
    console.warn("Failed to delete legacy caches:", error);
  }
}
