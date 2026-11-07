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
  plugins: [react(), socialMeta(), preloadDisplayFont()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          // No `vendor: ['react', 'react-dom']` entry. It never matched — React
          // resolves through a different specifier here, so Rollup put it in an
          // auto-named chunk of its own and emitted `vendor` as a 1-byte file.
          // Harmless (nothing preloads it) but the rule claimed to do something
          // it did not, which is worse than not having it.
          animations: ['framer-motion'],
          ui: ['@radix-ui/react-slot', '@radix-ui/react-toast', '@radix-ui/react-progress', '@radix-ui/react-switch'],
          state: ['zustand'],
          // Howler is deliberately not here. Its only importer is
          // src/utils/sounds.js, which only GameBoard imports, so Rollup keeps
          // it in the GameBoard chunk. Grouped with confetti it downloaded with
          // every dialog that celebrates, Daily Rewards' once-a-day auto-open
          // included, for players who might never start a battle.
          effects: ['canvas-confetti'],
          // Auth, the save and the leaderboard all import the client, so it
          // used to sit inside the entry chunk: every copy change re-downloaded
          // it. Its own chunk stays on the first paint (the session is restored
          // before the menu) and is cached across those changes. Howler is
          // still not here — see the effects note above.
          supabase: [
            '@supabase/supabase-js',
            '@supabase/auth-js',
            '@supabase/postgrest-js',
            '@supabase/functions-js',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
