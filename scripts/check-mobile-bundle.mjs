import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist-mobile");

const forbidden = [
  "uploadthing",
  "@anthropic-ai",
  "firecrawl",
  "UPLOADTHING",
  "ANTHROPIC",
  "process.env",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(js|css|html|json|map|txt)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const info = await stat(root).catch(() => null);
if (!info?.isDirectory()) {
  console.error(`Missing mobile bundle at ${root}. Run npm run mobile:build first.`);
  process.exit(1);
}

const files = await walk(root);
const hits = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      hits.push(`${path.relative(root, file)}: ${needle}`);
    }
  }
}

if (hits.length > 0) {
  console.error("Mobile bundle contains forbidden references:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`Mobile bundle OK (${files.length} files, no forbidden references).`);
