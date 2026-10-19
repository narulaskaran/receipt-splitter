// Web Share Target plumbing. Sharing a receipt photo/PDF to the installed app
// POSTs it to SHARE_TARGET_PATH, where the service worker (src/app/sw.ts)
// stashes the files in the Cache API and redirects to the home page, which
// takes them out and hands them to the uploader. A POST can't render a page,
// and the app has no server-side state, so the cache is the hand-off.

import { MAX_RECEIPTS_PER_SESSION } from "./constants";

export const SHARE_TARGET_PATH = "/share-target";
/** Multipart field the manifest's share_target.params.files uses. */
export const SHARE_TARGET_FIELD = "receipts";
/** Query param on the redirect that tells the home page about a share. */
export const SHARE_TARGET_PARAM = "share-target";
/** SHARE_TARGET_PARAM values. */
export const SHARE_TARGET_OK = "1"; // files are waiting in the cache
export const SHARE_TARGET_EMPTY = "empty"; // nothing usable was shared
export const SHARE_TARGET_ERROR = "error"; // the files were lost

const CACHE_NAME = "share-target";
const FILE_KEY_PREFIX = "/share-target/files/";

function isReceiptFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

/** Replace any previously stashed files with `files`. */
export async function storeSharedFiles(files: File[]): Promise<void> {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    files.map((file, index) =>
      cache.put(
        // Zero-padded so keys sort in the order the files were shared.
        `${FILE_KEY_PREFIX}${String(index).padStart(4, "0")}`,
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

/**
 * Handle the share POST in the service worker. Returns the path to redirect
 * to. Only same-origin POSTs are accepted: a page on another site can submit
 * a form to this URL, and the shared files are uploaded automatically. Origin
 * is "null" or missing for the OS share sheet, which is allowed; this stops
 * other sites that send their real origin, not every cross-site submission.
 */
export async function receiveSharedFiles(
  request: Request,
  ownOrigin: string
): Promise<string> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== "null" && origin !== ownOrigin) return "/";

  try {
    const formData = await request.formData();
    const files = formData
      .getAll(SHARE_TARGET_FIELD)
      .filter((value): value is File => value instanceof File)
      .filter(isReceiptFile)
      .slice(0, MAX_RECEIPTS_PER_SESSION);
    if (files.length === 0) return `/?${SHARE_TARGET_PARAM}=${SHARE_TARGET_EMPTY}`;

    await storeSharedFiles(files);
    return `/?${SHARE_TARGET_PARAM}=${SHARE_TARGET_OK}`;
  } catch (error) {
    // e.g. the cache quota is full
    console.error("Failed to receive shared files:", error);
    return `/?${SHARE_TARGET_PARAM}=${SHARE_TARGET_ERROR}`;
  }
}

/**
 * Read and clear the stashed files. Returns [] when there are none. The cache
 * is cleared even if reading a file fails, so a bad batch can't come back on
 * the next visit.
 */
export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(CACHE_NAME);
  try {
    const requests = [...(await cache.keys())].sort((a, b) =>
      a.url.localeCompare(b.url)
    );

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
    return files;
  } finally {
    await caches.delete(CACHE_NAME);
  }
}
