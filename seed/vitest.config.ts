import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // cli.ts solo resuelve rutas reales y llama a run(), que está testeado.
      exclude: ['src/**/*.test.ts', 'src/**/cli.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
