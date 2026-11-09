import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist-mobile");
const port = 4173;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function safePath(pathname) {
  const relative = pathname.replace(/^\/+/, "");
  const filePath = normalize(join(root, relative));
  if (filePath !== root && !filePath.startsWith(`${root}/`)) return null;
  return filePath;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  const filePath = safePath(pathname);
  if (filePath) {
    try {
      const data = await readFile(filePath);
      const type = types[extname(filePath)] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(data);
      return;
    } catch {
      // Fall through to the SPA shell for client routes.
    }
  }

  try {
    const html = await readFile(join(root, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist-mobile is missing. Run npm run mobile:build first.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mobile static server http://127.0.0.1:${port}`);
});
