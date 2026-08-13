import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom gives the store's persist middleware a real localStorage to write to.
    environment: 'jsdom',
    // ...except under Node >= 26, whose built-in localStorage global shadows
    // jsdom's and resolves to undefined without --localstorage-file. See
    // vitest.setup.js.
    setupFiles: ['./vitest.setup.js'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    restoreMocks: true,
  },
});
