/**
 * Renders public/og-image.jpg, the picture a shared link shows (1200x630).
 *
 * It used to be a purple gradient with system-sans type and emoji bears,
 * from before the redesign, so every link preview contradicted the game it
 * linked to. This draws it from the game itself: index.css's bar backdrop
 * and grain, the Baloo 2 brass wordmark, and the menu's card fan with three
 * shipped card arts (scripts/brand/brand.jsx), photographed in Chromium.
 *
 * Usage:
 *   npm run art:og
 *
 * Re-run it when the wordmark, the backdrop or those cards' art change. The
 * file stays under 200 kB, which every unfurler accepts; the script fails if
 * it does not. The alt text the build writes for it is in src/lib/siteMeta.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { withBrandPage, ROOT } from './brand/render.mjs';

const OUT = path.join(ROOT, 'public', 'og-image.jpg');
const MAX_BYTES = 200 * 1024;

const png = await withBrandPage((shoot) => shoot('kind=og', { width: 1200, height: 630 }, { wordmark: true }));
const jpeg = await sharp(png).jpeg({ quality: 84, progressive: true, mozjpeg: true }).toBuffer();
const { width, height } = await sharp(jpeg).metadata();
if (width !== 1200 || height !== 630) throw new Error(`og-image is ${width}x${height}, not 1200x630`);
if (jpeg.length > MAX_BYTES) throw new Error(`og-image is ${Math.round(jpeg.length / 1024)} kB, over the 200 kB budget`);
fs.writeFileSync(OUT, jpeg);
console.log(`wrote ${path.relative(ROOT, OUT)} (${width}x${height}, ${Math.round(jpeg.length / 1024)} kB)`);
