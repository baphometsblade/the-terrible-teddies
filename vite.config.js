import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: "8080",
  },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "lib",
        replacement: resolve(__dirname, "lib"),
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
          vendor: ['react', 'react-dom'],
          animations: ['framer-motion'],
          ui: ['@radix-ui/react-slot', '@radix-ui/react-toast', '@radix-ui/react-progress', '@radix-ui/react-switch'],
          state: ['zustand'],
          effects: ['canvas-confetti', 'howler'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
