import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { Ticket } from '../jira/mapeo.js';
import { abrirBase, MIGRACIONES, migrar } from './base.js';
import { Repositorio } from './repositorio.js';

export function ticketDePrueba(cambios: Partial<Ticket> = {}): Ticket {
  return {
    clave: 'PRJA-1',
    idOrigen: 'T-001',
    tipo: 'Tarea',
    estado: 'En curso',
    prioridad: 'Media',
    proyectoClave: 'PRJA',
    proyectoNombre: 'Proyecto Alfa',
    tipoProyecto: 'software',
    responsable: 'Agente 1',
    informador: 'Usuario 2',
    responsableProyecto: 'Usuario 3',
    titulo: 'Preparar ambiente de pruebas',
    creada: '2025-01-10T12:00:00.000Z',
    resuelta: null,
    actualizada: '2025-01-11T12:00:00.000Z',
    vencimiento: null,
    ...cambios,
  };
}

const version = (db: DatabaseSync) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

describe('base', () => {
  it('aplica las migraciones una sola vez', () => {
    const db = abrirBase(':memory:');
    expect(version(db)).toBe(MIGRACIONES.length);
    migrar(db);
    expect(version(db)).toBe(MIGRACIONES.length);
    db.close();
  });

  it('crea la carpeta y el archivo de la base', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashboard-db-'));
    try {
      const db = abrirBase(join(dir, 'sub', 'dashboard.db'));
      expect(version(db)).toBe(MIGRACIONES.length);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('revierte una migración que falla', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE tickets (x INTEGER)'); // choca con la primera migración
    expect(() => {
      migrar(db);
    }).toThrow();
    expect(version(db)).toBe(0);
    db.close();
  });
});

describe('Repositorio', () => {
  it('reemplaza y lista tickets', () => {
    const repo = new Repositorio(abrirBase(':memory:'));
    repo.reemplazarTickets([ticketDePrueba({ clave: 'PRJA-1' })]);

    const nuevos = [
      ticketDePrueba({
        clave: 'PRJB-2',
        resuelta: '2025-02-01T00:00:00.000Z',
        vencimiento: '2025-01-31',
      }),
      ticketDePrueba({ clave: 'PRJA-2' }),
    ];
    repo.reemplazarTickets(nuevos);

    expect(repo.listarTickets()).toEqual([nuevos[1], nuevos[0]]);
  });

  it('si falla a mitad de camino, conserva los tickets anteriores', () => {
    const repo = new Repositorio(abrirBase(':memory:'));
    const anteriores = [ticketDePrueba()];
    repo.reemplazarTickets(anteriores);

    const duplicados = [ticketDePrueba({ clave: 'X-1' }), ticketDePrueba({ clave: 'X-1' })];
    expect(() => {
      repo.reemplazarTickets(duplicados);
    }).toThrow();

    expect(repo.listarTickets()).toEqual(anteriores);
  });

  it('registra los syncs y distingue el último del último exitoso', () => {
    const repo = new Repositorio(abrirBase(':memory:'));
    expect(repo.ultimoSync()).toBeUndefined();
    expect(repo.ultimoSyncExitoso()).toBeUndefined();

    const exitoso = { inicio: 'a', fin: 'b', ok: true, tickets: 3, error: null };
    const fallido = {
      inicio: 'c',
      fin: 'd',
      ok: false,
      tickets: null,
      error: 'Jira respondió 503',
    };
    repo.registrarSync(exitoso);
    repo.registrarSync(fallido);

    expect(repo.ultimoSync()).toEqual(fallido);
    expect(repo.ultimoSyncExitoso()).toEqual(exitoso);
  });
});
