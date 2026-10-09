import type { Sincronizador } from './sincronizador.js';

/** Corre un sync al iniciar y después cada `intervaloMs`. */
export class ProgramadorDeSync {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly sincronizador: Pick<Sincronizador, 'sincronizar' | 'esperar'>,
    private readonly intervaloMs: number,
  ) {}

  iniciar(): void {
    if (this.timer) return;
    void this.sincronizador.sincronizar();
    this.timer = setInterval(() => {
      void this.sincronizador.sincronizar();
    }, this.intervaloMs);
  }

  /** Deja de programar syncs y espera al que esté en curso. */
  async detener(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.sincronizador.esperar();
  }
}
