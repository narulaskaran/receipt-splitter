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

// Shared files left in the cache longer than this are ignored and purged:
// receipts can contain names and partial card numbers, and a share that was
// never picked up shouldn't linger.
const MAX_AGE_MS = 10 * 60 * 1000;

const CACHE_NAME = "share-target";
const FILE_KEY_PREFIX = "/share-target/files/";

// The types the uploader can read (the same set its dropzone lists). A share
// bypasses the dropzone's filter, so it is applied here.
const RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

/**
 * The MIME type to treat a shared file as, or null if it isn't a receipt the
 * uploader can read (so not SVG, GIF, etc.). Some Android share sources send an empty or generic type for photos and
 * PDFs, so those fall back to the file extension.
 */
function receiptType(file: File): string | null {
  if (RECEIPT_TYPES.has(file.type)) return file.type;
  if (file.type === "" || file.type === "application/octet-stream") {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return EXTENSION_TYPES[extension] ?? null;
  }
  return null;
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
            "X-Stored-At": String(Date.now()),
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
  if (origin && origin !== "null" && origin !== ownOrigin) {
    console.warn(`Ignored a share POST from another origin: ${origin}`);
    return "/";
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll(SHARE_TARGET_FIELD)
      .filter((value): value is File => value instanceof File)
      .flatMap((file) => {
        const type = receiptType(file);
        if (!type) return [];
        // Store the inferred type so the uploader sees a real image/PDF.
        return [type === file.type ? file : new File([file], file.name, { type })];
      })
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
  try {
    const cache = await caches.open(CACHE_NAME);
    // Keys are zero-padded, so a plain string comparison keeps share order.
    const requests = [...(await cache.keys())].sort((a, b) =>
      a.url < b.url ? -1 : a.url > b.url ? 1 : 0
    );

    const files: File[] = [];
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      const storedAt = Number(response.headers.get("X-Stored-At"));
      if (!storedAt || Date.now() - storedAt > MAX_AGE_MS) continue;
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
