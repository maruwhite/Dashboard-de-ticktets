import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BOM } from './csv.js';
import { escribirExportDePrueba, ticketDePrueba } from './fixtures.js';
import { leerExport } from './leer-export.js';
import { run } from './run.js';

const HOY = new Date(Date.UTC(2026, 9, 9, 12, 0));

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seed-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const tickets = [
  ticketDePrueba({ clave: 'ZZZ-1', estado: 'Finalizada', resuelta: '12/ene/24 3:00 PM' }),
  ticketDePrueba({
    clave: 'ZZZ-2',
    tipoIncidencia: 'Incidente',
    creada: '15/ene/24 8:00 AM',
    informador: 'Tercera Ficticia',
  }),
];

describe('leerExport', () => {
  it('lee solo las columnas de la lista blanca y lista las descartadas', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, tickets);

    const lectura = await leerExport(ruta);

    expect(lectura.tickets).toHaveLength(2);
    expect(lectura.tickets[0]).toEqual(tickets[0]);
    expect(lectura.columnasDescartadas).toEqual(['Comentarios', 'ID de la incidencia']);
    expect(JSON.stringify(lectura.tickets)).not.toContain('comentario secreto');
  });

  it('interpreta celdas con texto enriquecido, hipervínculos, fórmulas, números y fechas', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, [ticketDePrueba()]);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ruta);
    const fila = libro.getWorksheet('Jira')?.getRow(2);
    if (!fila) throw new Error('sin fila');
    fila.getCell(2).value = { text: 'ZZZ-9', hyperlink: 'https://ejemplo.invalid/ZZZ-9' };
    fila.getCell(3).value = { richText: [{ text: 'Titulo ' }, { text: 'rico' }] };
    fila.getCell(4).value = { formula: 'A1', result: 'Persona Formula' };
    fila.getCell(5).value = 42;
    fila.getCell(6).value = { error: '#N/A' };
    fila.getCell(7).value = new Date(Date.UTC(2024, 0, 10, 9, 0));
    fila.getCell(12).value = '   ';
    await libro.xlsx.writeFile(ruta);

    const [ticket] = (await leerExport(ruta)).tickets;

    expect(ticket).toMatchObject({
      clave: 'ZZZ-9',
      resumen: 'Titulo rico',
      responsable: 'Persona Formula',
      informador: '42',
      estado: '',
      creada: new Date(Date.UTC(2024, 0, 10, 9, 0)),
      resuelta: null,
    });
  });

  it('saltea filas vacías', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, [ticketDePrueba(), { ...ticketDePrueba(), clave: '' }]);
    expect((await leerExport(ruta)).tickets).toHaveLength(1);
  });

  it('falla si no existe la hoja "Jira"', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, tickets, { hoja: 'Otra' });
    await expect(leerExport(ruta)).rejects.toThrow('no tiene una hoja llamada "Jira"');
  });

  it('falla nombrando la columna faltante', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, tickets, { sinColumna: 'estado' });
    await expect(leerExport(ruta)).rejects.toThrow('Faltan columnas en el export: Estado');
  });

  it('falla si un ticket no tiene fecha de creación', async () => {
    const ruta = join(dir, 'export.xlsx');
    await escribirExportDePrueba(ruta, [
      { ...ticketDePrueba(), creada: null as unknown as string },
    ]);
    await expect(leerExport(ruta)).rejects.toThrow('Ticket sin fecha de creación (fila 2)');
  });
});

describe('run', () => {
  it('genera tickets.csv y resumen.md sin datos originales, y loguea solo conteos', async () => {
    const entrada = join(dir, 'export.xlsx');
    const salidaDir = join(dir, 'anonimizado');
    await escribirExportDePrueba(entrada, tickets);
    const logs: string[] = [];

    const resultado = await run({
      entrada,
      salidaDir,
      hoy: HOY,
      diasAntesDeHoy: 2,
      log: (mensaje) => logs.push(mensaje),
    });

    expect(resultado.cantidad).toBe(2);
    const csv = await readFile(resultado.archivoTickets, 'utf8');
    const resumen = await readFile(resultado.archivoResumen, 'utf8');

    expect(csv.split('\r\n')[0]).toBe(
      BOM +
        'id_origen;tipo_incidencia;estado;prioridad;tipo_proyecto;proyecto_clave;proyecto_nombre;responsable;informador;responsable_proyecto;titulo;creada;resuelta',
    );
    expect(csv).toContain('T-001;Tarea;Finalizado;Media;software;PRJA;Proyecto Alfa;');
    expect(resumen).toContain('- Tickets: 2');
    expect(resumen).toContain('| Finalizado | 1 |');
    expect(resumen).toContain('- Comentarios');

    const salidas = [csv, resumen, logs.join('\n')];
    for (const original of [
      'Persona Ficticia',
      'Otra Ficticia',
      'Tercera Ficticia',
      'Lider Ficticio',
      'ZZZ',
      'Proyecto Inventado',
      'Titulo inventado uno',
      'comentario secreto',
    ]) {
      for (const salida of salidas) expect(salida).not.toContain(original);
    }
  });

  it('no escribe nada si detecta fugas', async () => {
    const entrada = join(dir, 'export.xlsx');
    const salidaDir = join(dir, 'anonimizado');
    // Un título original igual a una frase generada simula una fuga.
    await escribirExportDePrueba(entrada, [
      ticketDePrueba({ resumen: 'Actualizar configuración del reporte mensual' }),
    ]);

    await expect(
      run({ entrada, salidaDir, hoy: HOY, diasAntesDeHoy: 2, log: () => undefined }),
    ).rejects.toThrow('Se detectaron 1 celdas con valores originales');
    await expect(readFile(join(salidaDir, 'tickets.csv'))).rejects.toThrow();
  });
});
