import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // server.ts solo arranca el proceso (carga .env y abre el puerto); la lógica está en app/config/logger.
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/**/cli-*.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
