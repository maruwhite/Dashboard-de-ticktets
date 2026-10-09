import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('usa valores por defecto si no hay variables', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.JIRA_BASE_URL).toBeUndefined();
  });

  it('trata las variables vacías como no definidas', () => {
    const config = loadConfig({ PORT: '', JIRA_BASE_URL: '', JIRA_EMAIL: '', JIRA_API_TOKEN: '' });
    expect(config.PORT).toBe(3000);
    expect(config.JIRA_BASE_URL).toBeUndefined();
    expect(config.JIRA_API_TOKEN).toBeUndefined();
  });

  it('lee y convierte las variables definidas', () => {
    const config = loadConfig({
      PORT: '4000',
      LOG_LEVEL: 'debug',
      JIRA_BASE_URL: 'https://ejemplo.atlassian.net',
      JIRA_EMAIL: 'persona@example.com',
      JIRA_API_TOKEN: 'token-de-prueba',
    });
    expect(config).toEqual({
      PORT: 4000,
      LOG_LEVEL: 'debug',
      JIRA_BASE_URL: 'https://ejemplo.atlassian.net',
      JIRA_EMAIL: 'persona@example.com',
      JIRA_API_TOKEN: 'token-de-prueba',
    });
  });

  it('falla nombrando la variable inválida', () => {
    expect(() => loadConfig({ PORT: 'no-es-un-numero' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: 'no-es-un-numero' })).toThrow(/PORT/);
  });

  it('no incluye el valor inválido en el mensaje de error', () => {
    const secreto = 'valor-secreto-que-no-es-url';
    let message = '';
    try {
      loadConfig({ JIRA_BASE_URL: secreto });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('JIRA_BASE_URL');
    expect(message).not.toContain(secreto);
  });
});
