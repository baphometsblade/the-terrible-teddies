/**
 * Renders the app's icons from the brand mark: the brass medallion with the
 * bear on it that the loader, BootScreen and sign-in screen share, on the
 * bar backdrop (scripts/brand/brand.jsx), photographed in Chromium at
 * 1024px and scaled down.
 *
 * What it writes to public/, and why each exists:
 *   favicon.png            48px, the tab icon index.html links (it was a PNG
 *                          named favicon.ico and declared as an SVG).
 *   favicon.ico            16/32/48 in one file, for the clients that ask for
 *                          /favicon.ico without reading the page.
 *   icon-192/512.png       purpose "any": a rounded tile, shown as drawn.
 *   icon-maskable-192/512  purpose "maskable": full bleed, the mark inside
 *                          the centre 80% that every launcher's mask keeps.
 *                          Without one, Android shrank the "any" icon onto a
 *                          white disc.
 *   apple-touch-icon.png   180px, opaque and full bleed (iOS rounds it).
 *
 * Usage:
 *   npm run art:icons
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { withBrandPage, ROOT } from './brand/render.mjs';

const PUBLIC = path.join(ROOT, 'public');
const SOURCE = 1024;

const write = async (file, buffer) => {
  fs.writeFileSync(path.join(PUBLIC, file), buffer);
  console.log(`wrote public/${file} (${Math.round(buffer.length / 1024)} kB)`);
};
const png = (source, size) => sharp(source).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: size <= 64 ? false : true, quality: 92 }).toBuffer();

// An .ico holding PNG images, which every browser since IE Vista-era reads:
// a 6-byte header, a 16-byte entry per image, then the PNGs.
const ico = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // no palette
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
};

const shots = await withBrandPage(async (shoot) => {
  const viewport = { width: SOURCE, height: SOURCE };
  return {
    any: await shoot(`kind=any&size=${SOURCE}`, viewport, { transparent: true }),
    maskable: await shoot(`kind=maskable&size=${SOURCE}`, viewport),
    apple: await shoot(`kind=apple&size=${SOURCE}`, viewport),
    favicon: await shoot(`kind=favicon&size=${SOURCE}`, viewport, { transparent: true }),
  };
});

await write('icon-192.png', await png(shots.any, 192));
await write('icon-512.png', await png(shots.any, 512));
await write('icon-maskable-192.png', await png(shots.maskable, 192));
await write('icon-maskable-512.png', await png(shots.maskable, 512));
// Opaque: iOS fills any transparency with black.
await write('apple-touch-icon.png', await sharp(shots.apple).resize(180, 180, { kernel: 'lanczos3' }).flatten({ background: '#1a1226' }).png({ compressionLevel: 9 }).toBuffer());
await write('favicon.png', await png(shots.favicon, 48));
await write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(shots.favicon, size) })))));
