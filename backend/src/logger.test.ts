import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

function captureLogs() {
  const lines: string[] = [];
  return { lines, stream: { write: (line: string) => lines.push(line) } };
}

describe('createLogger', () => {
  it('redacta tokens, contraseñas y cabeceras de autorización', () => {
    const { lines, stream } = captureLogs();
    const logger = createLogger('info', stream);

    logger.info(
      {
        token: 'token-plano',
        JIRA_API_TOKEN: 'token-de-jira',
        headers: { authorization: 'Basic credencial' },
        jira: { apiToken: 'token-anidado', password: 'clave' },
      },
      'mensaje',
    );

    const output = lines.join('');
    for (const secret of ['token-plano', 'token-de-jira', 'credencial', 'token-anidado', 'clave']) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('mensaje');
  });

  it('respeta el nivel de log', () => {
    const { lines, stream } = captureLogs();
    const logger = createLogger('warn', stream);

    logger.info('no se escribe');
    logger.warn('sí se escribe');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('sí se escribe');
  });

  it('funciona sin destino explícito', () => {
    expect(createLogger('silent').level).toBe('silent');
  });
});
