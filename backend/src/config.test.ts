import { describe, expect, it } from 'vitest';
import { ConfigError, configJira, loadConfig } from './config.js';

const sinSync = { SYNC_ENABLED: 'false' };

const conSync = {
  JIRA_BASE_URL: 'https://ejemplo.atlassian.net/',
  JIRA_EMAIL: 'persona@example.com',
  JIRA_API_TOKEN: 'token-de-prueba',
  JIRA_FIELD_CREADA: 'customfield_1',
  JIRA_FIELD_RESUELTA: 'customfield_2',
  JIRA_FIELD_ID_ORIGEN: 'customfield_3',
  JIRA_FIELD_TIPO_PROYECTO: 'customfield_4',
  JIRA_FIELD_RESPONSABLE: 'customfield_5',
  JIRA_FIELD_INFORMADOR: 'customfield_6',
  JIRA_FIELD_RESPONSABLE_PROYECTO: 'customfield_7',
};

describe('loadConfig', () => {
  it('con el sync desactivado usa valores por defecto y no exige Jira', () => {
    const config = loadConfig(sinSync);
    expect(config).toMatchObject({
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_PATH: 'data/dashboard.db',
      SYNC_ENABLED: false,
      SYNC_INTERVAL_MINUTES: 5,
      JIRA_JQL: 'project in (PRJA, PRJB, PRJC, PRJD, PRJE)',
    });
    expect(config.JIRA_BASE_URL).toBeUndefined();
  });

  it('trata las variables vacías como no definidas', () => {
    const config = loadConfig({ ...sinSync, PORT: '', JIRA_BASE_URL: '', JIRA_API_TOKEN: '' });
    expect(config.PORT).toBe(3000);
    expect(config.JIRA_BASE_URL).toBeUndefined();
    expect(config.JIRA_API_TOKEN).toBeUndefined();
  });

  it('sin JIRA_BASE_URL ni SYNC_ENABLED, el sync se desactiva (modo demo)', () => {
    expect(loadConfig({}).SYNC_ENABLED).toBe(false);
    expect(loadConfig({ JIRA_API_TOKEN: 'token-de-prueba' }).SYNC_ENABLED).toBe(false);
  });

  it('con JIRA_BASE_URL el sync se activa solo y exige el resto, nombrándolo', () => {
    let mensaje = '';
    try {
      loadConfig({
        JIRA_BASE_URL: 'https://ejemplo.atlassian.net',
        JIRA_API_TOKEN: 'token-de-prueba',
      });
    } catch (error) {
      mensaje = (error as Error).message;
    }
    expect(mensaje).toContain('JIRA_EMAIL: obligatoria con el sync activado');
    expect(mensaje).toContain('JIRA_FIELD_RESPONSABLE_PROYECTO');
    expect(mensaje).not.toContain('JIRA_API_TOKEN:');
  });

  it('SYNC_ENABLED explícito manda sobre la detección automática', () => {
    expect(loadConfig({ ...conSync, SYNC_ENABLED: 'false' }).SYNC_ENABLED).toBe(false);
    expect(() => loadConfig({ SYNC_ENABLED: 'true' })).toThrow(/JIRA_BASE_URL: obligatoria/);
  });

  it('lee la configuración completa del sync', () => {
    const config = loadConfig({ ...conSync, SYNC_INTERVAL_MINUTES: '10', DATABASE_PATH: 'x.db' });
    expect(config).toMatchObject({
      SYNC_ENABLED: true,
      SYNC_INTERVAL_MINUTES: 10,
      DATABASE_PATH: 'x.db',
    });
  });

  it('valida el formato de los ids de campos y de SYNC_ENABLED', () => {
    expect(() => loadConfig({ ...conSync, JIRA_FIELD_CREADA: 'Creada' })).toThrow(
      /JIRA_FIELD_CREADA: debe tener la forma customfield_NNNNN/,
    );
    expect(() => loadConfig({ ...sinSync, SYNC_ENABLED: 'si' })).toThrow(/SYNC_ENABLED/);
  });

  it('falla nombrando la variable inválida, sin incluir su valor', () => {
    const secreto = 'valor-secreto-que-no-es-url';
    expect(() => loadConfig({ ...sinSync, PORT: 'no-es-un-numero' })).toThrow(ConfigError);
    let mensaje = '';
    try {
      loadConfig({ ...sinSync, JIRA_BASE_URL: secreto });
    } catch (error) {
      mensaje = (error as Error).message;
    }
    expect(mensaje).toContain('JIRA_BASE_URL');
    expect(mensaje).not.toContain(secreto);
  });
});

describe('configJira', () => {
  it('arma la configuración del cliente y los ids de campos', () => {
    expect(configJira(loadConfig(conSync))).toEqual({
      baseUrl: 'https://ejemplo.atlassian.net',
      email: 'persona@example.com',
      token: 'token-de-prueba',
      jql: 'project in (PRJA, PRJB, PRJC, PRJD, PRJE)',
      campos: {
        creada: 'customfield_1',
        resuelta: 'customfield_2',
        idOrigen: 'customfield_3',
        tipoProyecto: 'customfield_4',
        responsable: 'customfield_5',
        informador: 'customfield_6',
        responsableProyecto: 'customfield_7',
      },
    });
  });

  it('falla si se llama con el sync desactivado y sin credenciales', () => {
    expect(() => configJira(loadConfig(sinSync))).toThrow('Falta JIRA_BASE_URL');
  });
});
