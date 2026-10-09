import { describe, expect, it } from 'vitest';
import { ticketDePrueba } from '../anonimizar/fixtures.js';
import { contarValoresOriginales } from './verificar.js';

const originales = [
  ticketDePrueba({ resumen: 'Titulo inventado uno', responsable: 'Persona Ficticia' }),
];

describe('contarValoresOriginales', () => {
  it('no encuentra nada en una foto anonimizada', () => {
    const foto = JSON.stringify([
      { clave: 'PRJA-1', responsable: 'Agente 1', titulo: 'Preparar ambiente', estado: 'En curso' },
    ]);
    expect(contarValoresOriginales(foto, originales)).toBe(0);
  });

  it('detecta personas, proyectos, títulos y claves originales', () => {
    const foto = JSON.stringify([
      {
        responsable: 'Persona Ficticia',
        proyectoNombre: 'Proyecto Inventado',
        titulo: 'Titulo inventado uno',
        idOrigen: 'ZZZ-1',
      },
    ]);
    // Persona, proyecto (clave "ZZZ" y nombre), título y clave del ticket.
    expect(contarValoresOriginales(foto, originales)).toBe(5);
  });
});
