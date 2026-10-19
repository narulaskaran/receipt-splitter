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

describe("any icons", () => {
  it.each(["icon-192.png", "icon-512.png"])(
    "%s has transparent corners and a filled (white) glyph",
    async (name) => {
      const { data, info } = await sharp(path.join(publicDir, name))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const alphaAt = (x: number, y: number) =>
        data[(y * info.width + x) * info.channels + 3];
      expect(alphaAt(0, 0)).toBe(0);
      expect(alphaAt(info.width - 1, info.height - 1)).toBe(0);
      // The receipt glyph sits left of centre; it must be opaque, not a
      // cut-out that shows the launcher background.
      expect(alphaAt(Math.round(info.width * 0.3), Math.round(info.height * 0.55))).toBe(255);
    },
  );
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
  const ico = fs.readFileSync(path.join(root, "src", "app", "favicon.ico"));

  it("is a real ICO, not a renamed PNG, and stays small", () => {
    // ICO header: reserved = 0, type = 1 (icon)
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.length).toBeLessThan(50 * 1024);
  });

  it("contains 16, 32 and 48px PNG images that fit inside the file", async () => {
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);

    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const size = ico.readUInt8(entry);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(offset + length).toBeLessThanOrEqual(ico.length);

      const { width, height } = await sharp(
        ico.subarray(offset, offset + length),
      ).metadata();
      expect([width, height]).toEqual([size, size]);
      sizes.push(size);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });
});
