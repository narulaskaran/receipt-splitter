// Builds the opaque iOS app icon and launch images from assets/app-icon.png.
//
// Run with `node scripts/generate-ios-assets.mjs` after the source icon or
// the app background color changes, then commit the PNGs. Not part of the
// Next.js build.
//
// The 1024 icon is the source composited onto PWA_BACKGROUND_LIGHT
// (src/lib/pwa.ts, which mirrors the light --background in globals.css).
// Transparent corners and the cut-out glyph both become that color, and the
// PNG has no alpha channel. Apple still applies its own mask; this was not
// opened in Xcode.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

function backgroundColor() {
  const pwa = fs.readFileSync(path.join(root, "src/lib/pwa.ts"), "utf8");
  const match = pwa.match(
    /export const PWA_BACKGROUND_LIGHT = "(#[0-9a-fA-F]{6})"/,
  );
  if (!match) {
    throw new Error("Could not read PWA_BACKGROUND_LIGHT from src/lib/pwa.ts");
  }
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  if (!/^\s*--background:/m.test(css)) {
    throw new Error("src/app/globals.css has no --background token");
  }
  return match[1];
}

async function flattenedIcon(color) {
  const source = path.join(root, "assets/app-icon.png");
  return sharp(source)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "fill" })
    .flatten({ background: color })
    .removeAlpha()
    .png()
    .toBuffer();
}

async function splashImage(color, iconPng) {
  const offset = Math.floor((SPLASH_SIZE - ICON_SIZE) / 2);
  return sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 3,
      background: color,
    },
  })
    .composite([{ input: iconPng, left: offset, top: offset }])
    .removeAlpha()
    .png()
    .toBuffer();
}

async function reportOpacity(png, label, width, height) {
  const image = sharp(png);
  const meta = await image.metadata();
  const stats = await image.stats();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];
  const corners = [
    alphaAt(0, 0),
    alphaAt(width - 1, 0),
    alphaAt(0, height - 1),
    alphaAt(width - 1, height - 1),
  ];
  const center = Math.floor(width / 2);
  const centerAlpha = alphaAt(center, center);
  const opaque =
    meta.width === width &&
    meta.height === height &&
    meta.hasAlpha !== true &&
    stats.isOpaque === true &&
    corners.every((alpha) => alpha === 255) &&
    centerAlpha === 255;

  console.log(
    `${label}: ${meta.width}x${meta.height} hasAlpha=${meta.hasAlpha} isOpaque=${stats.isOpaque} cornerAlpha=${corners.join(",")} centerAlpha=${centerAlpha} flattened=${opaque}`,
  );
  if (!opaque) {
    throw new Error(`${label} is not a flattened opaque ${width}x${height} image`);
  }
}

async function main() {
  const color = backgroundColor();
  console.log(`Background ${color} from src/lib/pwa.ts (light --background)`);

  const icon = await flattenedIcon(color);
  await reportOpacity(icon, "AppIcon-512@2x.png", ICON_SIZE, ICON_SIZE);

  const iconPath = path.join(
    root,
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
  );
  fs.writeFileSync(iconPath, icon);

  const splash = await splashImage(color, icon);
  await reportOpacity(splash, "splash-2732x2732.png", SPLASH_SIZE, SPLASH_SIZE);
  const splashDir = path.join(
    root,
    "ios/App/App/Assets.xcassets/Splash.imageset",
  );
  for (const name of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ]) {
    fs.writeFileSync(path.join(splashDir, name), splash);
  }

  console.log("Wrote opaque app icon and splash images.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
