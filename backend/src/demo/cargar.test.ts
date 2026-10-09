import type { Ticket } from '@dashboard/shared';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base.js';
import { Repositorio } from '../db/repositorio.js';
import { cargarDemo, leerTicketsDemo, RUTA_DEMO, serializarDemo } from './cargar.js';

const ticket: Ticket = {
  clave: 'PRJA-1',
  idOrigen: 'T-001',
  tipo: 'Tarea',
  estado: 'Finalizado',
  prioridad: 'Media',
  proyectoClave: 'PRJA',
  proyectoNombre: 'Proyecto Alfa',
  tipoProyecto: 'software',
  responsable: 'Agente 1',
  informador: 'Usuario 2',
  responsableProyecto: 'Usuario 3',
  titulo: 'Preparar ambiente de pruebas',
  creada: '2025-01-10T12:00:00.000Z',
  resuelta: '2025-01-12T12:00:00.000Z',
  actualizada: '2026-10-09T19:05:58.435Z',
  vencimiento: null,
};

describe('foto de demo', () => {
  it('se serializa y se vuelve a leer igual', () => {
    expect(leerTicketsDemo(serializarDemo([ticket]))).toEqual([ticket]);
    expect(serializarDemo([ticket]).endsWith(']\n')).toBe(true);
  });

  it('rechaza contenido con forma inesperada, nombrando el campo', () => {
    expect(() => leerTicketsDemo(JSON.stringify([{ ...ticket, creada: 'ayer' }]))).toThrow(
      /La foto de demo no es válida: 0\.creada/,
    );
    expect(() => leerTicketsDemo(JSON.stringify([{ ...ticket, extra: 'x' }]))).toThrow(
      /La foto de demo no es válida/,
    );
  });

  it('cargarDemo reemplaza los tickets de la base', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demo-'));
    try {
      const ruta = join(dir, 'tickets.json');
      await writeFile(ruta, serializarDemo([ticket]), 'utf8');
      const repositorio = new Repositorio(abrirBase(':memory:'));
      repositorio.reemplazarTickets([{ ...ticket, clave: 'VIEJO-1' }]);

      expect(await cargarDemo(repositorio, ruta)).toBe(1);
      expect(repositorio.listarTickets()).toEqual([ticket]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('la ruta por defecto apunta a backend/demo/tickets.json', () => {
    expect(RUTA_DEMO.replaceAll('\\', '/')).toMatch(/backend\/demo\/tickets\.json$/);
  });
});
