import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom no implementa ResizeObserver (lo usan los gráficos de Recharts) ni matchMedia.
class ResizeObserverFalso {
  observe() {
    // sin medidas en jsdom
  }
  unobserve() {
    // sin medidas en jsdom
  }
  disconnect() {
    // sin medidas en jsdom
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverFalso);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
