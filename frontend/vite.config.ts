import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, /api se redirige al backend propio. El frontend nunca habla con Jira.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx solo monta la app en el DOM.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts', 'src/vite-env.d.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
