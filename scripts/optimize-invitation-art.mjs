import { copyFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDir = path.resolve('public/invitation-art');
const outputDir = path.join(sourceDir, 'responsive');
const images = [
  'botanical-poetry',
  'mediterranean-light',
  'afterglow',
];
const widths = [640, 1280, 1920];

await mkdir(outputDir, { recursive: true });
for (const image of images) {
  const source = path.join(sourceDir, image + '.png');
  for (const width of widths) {
    await Promise.all([
      sharp(source)
        .resize({ width })
        .avif({ quality: 48, effort: 6 })
        .toFile(path.join(outputDir, `${image}-${width}.avif`)),
      sharp(source)
        .resize({ width })
        .webp({ quality: 72, effort: 5 })
        .toFile(path.join(outputDir, `${image}-${width}.webp`)),
    ]);
  }
  const optimizedFallback = source + '.optimized';
  await sharp(source)
    .png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true })
    .toFile(optimizedFallback);
  await copyFile(optimizedFallback, source);
  await unlink(optimizedFallback);
}
console.log('Optimized PNG fallbacks and generated AVIF/WebP artwork at 640, 1280 and 1920 px.');
