const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-maskable-192.png', background: true },
  { size: 512, name: 'icon-maskable-512.png', background: true },
];

const publicDir = path.join(__dirname, '..', 'public');
const iconSvg = path.join(publicDir, 'icon.svg');

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const { size, name, background } of sizes) {
    const outputPath = path.join(publicDir, name);

    if (background) {
      // For maskable icons, add padding (safe zone)
      const paddedSize = Math.floor(size * 0.8);
      await sharp(iconSvg)
        .resize(paddedSize, paddedSize)
        .extend({
          top: Math.floor((size - paddedSize) / 2),
          bottom: Math.floor((size - paddedSize) / 2),
          left: Math.floor((size - paddedSize) / 2),
          right: Math.floor((size - paddedSize) / 2),
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
    } else {
      await sharp(iconSvg)
        .resize(size, size)
        .png()
        .toFile(outputPath);
    }

    console.log(`✓ Generated ${name}`);
  }

  console.log('✓ All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
