// Web Share Target plumbing. Sharing a receipt photo/PDF to the installed app
// POSTs it to SHARE_TARGET_PATH, where the service worker (src/app/sw.ts)
// stashes the files in the Cache API and redirects to the home page, which
// takes them out and hands them to the uploader. A POST can't render a page,
// and the app has no server-side state, so the cache is the hand-off.

export const SHARE_TARGET_PATH = "/share-target";
/** Multipart field the manifest's share_target.params.files uses. */
export const SHARE_TARGET_FIELD = "receipts";
/** Query param on the redirect that tells the home page files are waiting. */
export const SHARE_TARGET_PARAM = "share-target";

const CACHE_NAME = "share-target";
const FILE_KEY_PREFIX = "/share-target/files/";

/** Replace any previously stashed files with `files`. */
export async function storeSharedFiles(files: File[]): Promise<void> {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    files.map((file, index) =>
      cache.put(
        `${FILE_KEY_PREFIX}${index}`,
        new Response(file, {
          headers: {
            "Content-Type": file.type,
            "X-File-Name": encodeURIComponent(file.name),
          },
        })
      )
    )
  );
}

/** Read and clear the stashed files. Returns [] when there are none. */
export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(CACHE_NAME);
  const index = (request: Request) =>
    Number(request.url.slice(request.url.lastIndexOf("/") + 1));
  const requests = [...(await cache.keys())].sort((a, b) => index(a) - index(b));

  const files: File[] = [];
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    const blob = await response.blob();
    const name = decodeURIComponent(
      response.headers.get("X-File-Name") ?? "receipt"
    );
    files.push(new File([blob], name, { type: blob.type }));
  }
  await caches.delete(CACHE_NAME);
  return files;
}
