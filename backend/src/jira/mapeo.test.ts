import { describe, expect, it } from 'vitest';
import { aTicket, fechaIso } from './mapeo.js';

const campos = {
  creada: 'customfield_1',
  resuelta: 'customfield_2',
  idOrigen: 'customfield_3',
  tipoProyecto: 'customfield_4',
  responsable: 'customfield_5',
  informador: 'customfield_6',
  responsableProyecto: 'customfield_7',
};

const base = {
  summary: ' Preparar ambiente de pruebas ',
  status: { name: 'Finalizado' },
  issuetype: { name: 'Tarea' },
  priority: { name: 'Media' },
  project: { key: 'PRJA', name: 'Proyecto Alfa', projectTypeKey: 'software' },
  assignee: { displayName: 'Persona Nativa' },
  reporter: { displayName: 'Informador Nativo' },
  created: '2026-10-09T16:05:56.919-0300',
  updated: '2026-10-09T16:06:10.000-0300',
  resolutiondate: '2026-10-09T16:06:10.000-0300',
  duedate: null,
};

describe('aTicket', () => {
  it('usa los campos personalizados de la carga', () => {
    const ticket = aTicket(
      {
        key: 'PRJA-1',
        fields: {
          ...base,
          customfield_1: '2022-07-02T10:21:00.000-0300',
          customfield_2: '2022-08-16T11:51:00.000-0300',
          customfield_3: 'T-001',
          customfield_4: 'service_desk',
          customfield_5: 'Agente 1',
          customfield_6: 'Usuario 6',
          customfield_7: 'Usuario 1',
          duedate: '2022-07-30',
        },
      },
      campos,
    );

    expect(ticket).toEqual({
      clave: 'PRJA-1',
      idOrigen: 'T-001',
      tipo: 'Tarea',
      estado: 'Finalizado',
      prioridad: 'Media',
      proyectoClave: 'PRJA',
      proyectoNombre: 'Proyecto Alfa',
      tipoProyecto: 'service_desk',
      responsable: 'Agente 1',
      informador: 'Usuario 6',
      responsableProyecto: 'Usuario 1',
      titulo: 'Preparar ambiente de pruebas',
      creada: '2022-07-02T13:21:00.000Z',
      resuelta: '2022-08-16T14:51:00.000Z',
      actualizada: '2026-10-09T19:06:10.000Z',
      vencimiento: '2022-07-30',
    });
  });

  it('cae en los campos nativos si el ticket se creó a mano en Jira', () => {
    const ticket = aTicket({ key: 'PRJB-9', fields: base }, campos);

    expect(ticket).toMatchObject({
      idOrigen: '',
      tipoProyecto: 'software',
      responsable: 'Persona Nativa',
      informador: 'Informador Nativo',
      responsableProyecto: '',
      creada: '2026-10-09T19:05:56.919Z',
      resuelta: '2026-10-09T19:06:10.000Z',
      vencimiento: null,
    });
  });

  it('tolera campos ausentes o con formas inesperadas', () => {
    const ticket = aTicket({ key: 'X-1', fields: { status: 'raro', project: null } }, campos);

    expect(ticket).toMatchObject({
      estado: '',
      tipo: '',
      proyectoClave: '',
      creada: '',
      resuelta: null,
      actualizada: '',
    });
  });
});

describe('fechaIso', () => {
  it('normaliza el formato de Jira a ISO UTC', () => {
    expect(fechaIso('2022-07-02T10:21:00.000-0300')).toBe('2022-07-02T13:21:00.000Z');
    expect(fechaIso('2022-07-02T10:21:00.000+05:30')).toBe('2022-07-02T04:51:00.000Z');
  });

  it('devuelve null para valores vacíos o inválidos', () => {
    expect(fechaIso(undefined)).toBeNull();
    expect(fechaIso('')).toBeNull();
    expect(fechaIso('no es fecha')).toBeNull();
  });
});
