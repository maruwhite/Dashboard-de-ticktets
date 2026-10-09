export type Permiso = { permitido: true } | { permitido: false; esperarSegundos: number };

/** Permite una acción como máximo una vez cada `intervaloMs` (el botón "Sincronizar ahora"). */
export class Limitador {
  private ultimo: number | undefined;

  constructor(
    private readonly intervaloMs: number,
    private readonly ahora: () => number = Date.now,
  ) {}

  intentar(): Permiso {
    const ahora = this.ahora();
    if (this.ultimo !== undefined && ahora - this.ultimo < this.intervaloMs) {
      return {
        permitido: false,
        esperarSegundos: Math.ceil((this.intervaloMs - (ahora - this.ultimo)) / 1000),
      };
    }
    this.ultimo = ahora;
    return { permitido: true };
  }
}
