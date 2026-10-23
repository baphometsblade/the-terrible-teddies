// Shared by scripts/make-og-image.mjs and scripts/make-icons.mjs: serves
// scripts/brand/brand.html through Vite with the project's own config (so it
// gets the real index.css, Tailwind theme and components), opens it in
// Playwright's Chromium, and photographs #stage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import autoprefixer from 'autoprefixer';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Through Tailwind's own loader: the config is CommonJS in an ES package.
const tailwindConfig = loadConfig(path.join(ROOT, 'tailwind.config.js'));

/**
 * Runs `fn(shoot)` with a page ready to photograph; `shoot(query, viewport,
 * { transparent, wordmark })` returns a PNG buffer of #stage for
 * brand.html?<query>. `wordmark` says the picture sets type in Baloo 2, which
 * must then have loaded.
 */
export async function withBrandPage(fn) {
  const server = await createServer({
    configFile: path.join(ROOT, 'vite.config.js'),
    root: ROOT,
    logLevel: 'warn',
    // Any free port; nothing else talks to it. node_modules by its real path
    // too, for a checkout that links it in from elsewhere (the fonts live
    // there).
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      fs: { allow: [ROOT, fs.realpathSync(path.join(ROOT, 'node_modules'))] },
    },
    // The project's PostCSS, with the brand page added to Tailwind's content
    // so the few classes only it uses are generated too.
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            ...tailwindConfig,
            content: [...tailwindConfig.content, path.join(ROOT, 'scripts/brand/**/*.{html,jsx}')],
          }),
          autoprefixer(),
        ],
      },
    },
  });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  try {
    const shoot = async (query, viewport, { transparent = false, wordmark = false } = {}) => {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.goto(`${base}scripts/brand/brand.html?${query}`);
      const stage = page.locator('#stage');
      await stage.waitFor();
      // Fonts and every card image in, before the picture is taken. A
      // wordmark in the fallback face would ship silently, so its absence
      // is an error.
      await page.evaluate(() => document.fonts.ready);
      const baloo = !wordmark || await page.evaluate(() => [...document.fonts]
        .some((f) => f.family.includes('Baloo 2') && f.weight === '800' && f.status === 'loaded'));
      if (!baloo) throw new Error('Baloo 2 did not load; the image would use a fallback face');
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
      // Decoded and painted, not only fetched. The art is decoding="async",
      // and the compositor rasters an async image at its drawn (enlarged)
      // size in its own time, so a picture taken at once could catch a card
      // with no art yet. Synchronous for the photograph, and a moment to paint.
      await page.evaluate(async () => {
        for (const img of document.images) img.decoding = 'sync';
        await Promise.all([...document.images].map((img) => img.decode()));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      await page.waitForTimeout(500);
      const png = await stage.screenshot({ type: 'png', omitBackground: transparent });
      await page.close();
      return png;
    };
    return await fn(shoot);
  } finally {
    await browser.close();
    await server.close();
  }
}
