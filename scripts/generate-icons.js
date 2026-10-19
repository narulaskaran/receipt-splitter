// Generates the PWA / favicon icon set from assets/app-icon.png.
//
// Run manually with `npm run generate-icons` after changing the source image
// and commit the output. It is deliberately not part of `prebuild`, so builds
// don't depend on sharp and the committed icons can't drift.
//
// The source is a 1024px rounded-square icon with transparent corners. Its
// glyph is cut out of the blue (transparent), so it is filled with white first;
// otherwise it would show the launcher background through it.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceIcon = path.join(root, 'assets', 'app-icon.png');
const publicDir = path.join(root, 'public');
const faviconPath = path.join(root, 'src', 'app', 'favicon.ico');

// Fraction of the canvas the rounded square occupies in the "any" icons.
const ANY_SCALE = 0.79;
// Fraction of the rounded square's side the white underlay is inset by. It
// sits between the corner radius' inset and the glyph's edge.
const UNDERLAY_INSET = 0.1;
// Fraction trimmed off each side of the rounded square before extending its
// edge colour to the canvas edge. It must exceed the corner radius' inset
// (about 5% of the side) so no transparent corner pixels survive.
const FULL_BLEED_INSET = 0.08;

// The source with its glyph filled white and its corners still transparent.
// The white underlay is inset from the rounded square's edge, so it can't
// reach the corners.
async function solidSource() {
  const { info } = await sharp(sourceIcon)
    .trim()
    .toBuffer({ resolveWithObject: true });
  // trimOffset* are negative: the crop's offset from the original's origin.
  const left = -info.trimOffsetLeft;
  const top = -info.trimOffsetTop;
  const inset = Math.round(Math.min(info.width, info.height) * UNDERLAY_INSET);
  const underlay = await sharp({
    create: {
      width: info.width - inset * 2,
      height: info.height - inset * 2,
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer();
  return sharp(sourceIcon)
    .composite([
      { input: underlay, left: left + inset, top: top + inset, blend: 'dest-over' },
    ])
    .png()
    .toBuffer();
}

async function trimmedSquare() {
  const { data, info } = await sharp(await solidSource())
    .trim()
    .toBuffer({ resolveWithObject: true });
  const side = Math.min(info.width, info.height);
  return sharp(data).extract({ left: 0, top: 0, width: side, height: side });
}

// Transparent-cornered icon for purpose "any".
async function anyIcon(size) {
  return sharp(await solidSource()).resize(size, size).png();
}

// Opaque, full-bleed icon: the artwork stays at the same scale as the "any"
// icon while its edge colour fills the whole canvas. The OS applies its own
// mask (maskable on Android, rounded corners on iOS), so the glyph stays
// inside the safe zone and no white or black halo shows.
async function fullBleedIcon(size) {
  const square = await trimmedSquare();
  const inner = Math.round(size * ANY_SCALE);
  const resized = await square.resize(inner, inner).png().toBuffer();
  const inset = Math.round(inner * FULL_BLEED_INSET);
  const cropped = await sharp(resized)
    .extract({
      left: inset,
      top: inset,
      width: inner - inset * 2,
      height: inner - inset * 2,
    })
    .png()
    .toBuffer();
  const croppedSize = inner - inset * 2;
  const before = Math.floor((size - croppedSize) / 2);
  const after = size - croppedSize - before;
  return sharp(cropped)
    .extend({
      top: before,
      bottom: after,
      left: before,
      right: after,
      extendWith: 'copy',
    })
    .removeAlpha()
    .png();
}

// Minimal ICO container with embedded PNG images (supported by all current
// browsers). sharp can't write ICO itself.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = header.length + entries.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, o);
    entries.writeUInt8(size >= 256 ? 0 : size, o + 1);
    entries.writeUInt8(0, o + 2);
    entries.writeUInt8(0, o + 3);
    entries.writeUInt16LE(1, o + 4);
    entries.writeUInt16LE(32, o + 6);
    entries.writeUInt32LE(data.length, o + 8);
    entries.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, entries, ...images.map((i) => i.data)]);
}

async function generateIcons() {
  console.log('Generating icons...');

  const outputs = [
    ['icon-192.png', await anyIcon(192)],
    ['icon-512.png', await anyIcon(512)],
    ['icon-maskable-192.png', await fullBleedIcon(192)],
    ['icon-maskable-512.png', await fullBleedIcon(512)],
    ['apple-touch-icon.png', await fullBleedIcon(180)],
  ];
  for (const [name, pipeline] of outputs) {
    await pipeline.toFile(path.join(publicDir, name));
    console.log(`✓ Generated public/${name}`);
  }

  // Favicons use the trimmed square so the artwork fills the tiny canvas.
  const square = await trimmedSquare();
  const faviconImages = [];
  for (const size of [16, 32, 48]) {
    const data = await square.clone().resize(size, size).png().toBuffer();
    faviconImages.push({ size, data });
  }
  fs.writeFileSync(faviconPath, buildIco(faviconImages));
  console.log('✓ Generated src/app/favicon.ico');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
