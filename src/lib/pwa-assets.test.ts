/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.join(__dirname, "..", "..");
const publicDir = path.join(root, "public");

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(publicDir, "manifest.json"), "utf8"),
) as { icons: ManifestIcon[] };

describe("manifest icons", () => {
  it.each(manifest.icons.map((icon) => [icon.src, icon] as const))(
    "%s exists at its declared size",
    async (_src, icon) => {
      const file = path.join(publicDir, icon.src);
      expect(fs.existsSync(file)).toBe(true);

      const { width, height } = await sharp(file).metadata();
      expect(`${width}x${height}`).toBe(icon.sizes);
    },
  );

  it("declares 192 and 512 icons for both any and maskable purposes", () => {
    const declared = manifest.icons.map(
      (icon) => `${icon.purpose ?? "any"}:${icon.sizes}`,
    );
    expect(declared).toEqual(
      expect.arrayContaining([
        "any:192x192",
        "any:512x512",
        "maskable:192x192",
        "maskable:512x512",
      ]),
    );
  });

  it("keeps maskable icons fully opaque so the OS mask leaves no halo", async () => {
    const maskable = manifest.icons.filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
    for (const icon of maskable) {
      const { isOpaque } = await sharp(path.join(publicDir, icon.src)).stats();
      expect(isOpaque).toBe(true);
    }
  });
});

describe("apple touch icon", () => {
  const file = path.join(publicDir, "apple-touch-icon.png");

  it("is 180x180", async () => {
    const { width, height } = await sharp(file).metadata();
    expect([width, height]).toEqual([180, 180]);
  });

  it("is opaque, because iOS fills transparency with black", async () => {
    const { isOpaque } = await sharp(file).stats();
    expect(isOpaque).toBe(true);
  });
});

describe("favicon", () => {
  it("is a real ICO, not a renamed PNG, and stays small", () => {
    const ico = fs.readFileSync(path.join(root, "src", "app", "favicon.ico"));
    // ICO header: reserved = 0, type = 1 (icon)
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.length).toBeLessThan(50 * 1024);
  });
});
