import { defineConfig } from 'vitest/config';
import angular from '@nx/angular/plugins/vitest';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
  },
  resolve: {
    mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
  },
});
