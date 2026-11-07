import { existsSync, mkdirSync, renameSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { siteUrlFrom, socialMetaTags } from "./src/lib/siteMeta.js";

// The display face is font-display: swap, so the wordmark can jump when
// Baloo 2 arrives. Preloading the woff2 starts that download with the
// document instead of after the stylesheet, which is the jump. woff stays
// a fallback for browsers that cannot read woff2; they are not preloaded.
export const preloadDisplayFont = () => ({
  name: "preload-display-font",
  transformIndexHtml: {
    order: "post",
    handler(_html, ctx) {
      const bundle = ctx?.bundle;
      if (!bundle) return;
      return Object.values(bundle)
        .filter((file) => file.type === "asset" && /baloo-2-latin-(?:600|800)-normal-[\w-]+\.woff2$/.test(file.fileName))
        .map((file) => ({
          tag: "link",
          injectTo: "head",
          attrs: {
            rel: "preload",
            as: "font",
            type: "font/woff2",
            href: `/${file.fileName}`,
            crossorigin: "anonymous",
          },
        }));
    },
  },
});

// The link preview's absolute URLs (og:url, og:image and its size and alt,
// twitter:image), injected into index.html from the site's address. Shared
// links got no picture from a relative og:image. With no address configured
// (VITE_SITE_URL, or Vercel's production domain) the tags are left out, not
// guessed. A plugin rather than %VITE_SITE_URL% in index.html: Vite leaves an
// undefined %VAR% in the page verbatim, which would ship a broken URL, and
// it keeps index.html's inline script, whose hash vercel.json pins, as it is.
// See src/lib/siteMeta.js.
// Source maps are generated so a crash can be read, and then taken out of
// dist/. Vite's `hidden` already omits the sourceMappingURL comment, so a
// browser will not ask for them; moving the files is what stops the host
// from serving them to anyone who guesses the name. Upload sourcemaps/ to
// Sentry from a trusted machine. They are gitignored.
export const hideSourceMaps = () => ({
  name: "hide-source-maps",
  apply: "build",
  writeBundle(outputOptions, bundle) {
    const outDir = outputOptions.dir;
    if (!outDir) return;
    const destRoot = resolve(outDir, "..", "sourcemaps");
    for (const fileName of Object.keys(bundle)) {
      if (!fileName.endsWith(".map")) continue;
      const from = resolve(outDir, fileName);
      if (!existsSync(from)) continue;
      const to = resolve(destRoot, fileName);
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
    }
  },
});

// The error monitor and the vitals reporter are dynamic imports. Naming their
// chunks and keeping them out of the entry's modulepreload list means a
// visitor does not download either until the code actually asks.
// Howler is deliberately not grouped: its only importer is sounds.js, which
// only GameBoard imports, so it stays in that chunk.
export const manualChunks = (id) => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("@sentry")) return "sentry";
  if (id.includes("web-vitals")) return "web-vitals";
  if (id.includes("framer-motion")) return "animations";
  if (id.includes("@radix-ui")) return "ui";
  if (id.includes("zustand")) return "state";
  if (id.includes("canvas-confetti")) return "effects";
  if (id.includes("@supabase")) return "supabase";
  return undefined;
};

export const socialMeta = () => {
  let tags = [];
  return {
    name: "social-meta",
    configResolved(config) {
      const site = siteUrlFrom({ ...process.env, ...config.env });
      tags = site ? socialMetaTags(site) : [];
      if (!site && config.command === "build") {
        config.logger.warn(
          "social-meta: no VITE_SITE_URL (or VERCEL_PROJECT_PRODUCTION_URL), so the build has no og:image; shared links will show no picture."
        );
      }
    },
    transformIndexHtml: () => tags,
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: "8080",
  },
  plugins: [react(), socialMeta(), preloadDisplayFont(), hideSourceMaps()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      // supabase-js statically imports Realtime and Storage and constructs both
      // in its constructor, so they ship in the entry chunk whether or not the
      // app uses them. This one never opens a channel or touches a bucket — it
      // uses auth, .from() and .rpc() and nothing else — so both were dead
      // weight on every first paint. Measured: -84.66 kB raw / -22.88 kB gzip.
      //
      // Aliased rather than replacing the supabase-js facade with hand-wired
      // GoTrueClient + PostgrestClient: that rewrite would mean reimplementing
      // _handleTokenChanged, which swaps the PostgREST Authorization header on
      // every auth change. Get that subtly wrong and RPCs fall back to the anon
      // key, breaking every auth.uid()-guarded function — and the e2e suite
      // stubs the network, so it would not catch it. Aliasing leaves all of
      // that machinery untouched.
      //
      // src/stubs/supabase-stubs.test.js fails the build if a supabase-js
      // upgrade starts importing a name the stubs do not export.
      {
        find: "@supabase/realtime-js",
        replacement: fileURLToPath(new URL("./src/stubs/supabase-realtime.js", import.meta.url)),
      },
      {
        find: "@supabase/storage-js",
        replacement: fileURLToPath(new URL("./src/stubs/supabase-storage.js", import.meta.url)),
      },
    ],
  },
  build: {
    // Vite 7's default is Baseline Widely Available (Safari 16). iOS 15 is
    // still in the field, and a syntax it cannot parse fails the module
    // before React mounts — the loader never leaves. safari15 is the floor
    // esbuild will downlevel to. It does not polyfill methods; those are
    // avoided in shipped source (see safeStorage and DailyRewards).
    target: 'safari15',
    cssTarget: 'safari15',
    sourcemap: "hidden",
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !/\/(sentry|web-vitals)-/.test(dep));
      },
    },
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
