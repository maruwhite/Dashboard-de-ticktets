import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('API', () => {
  it('GET /api/health responde ok', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('no expone la tecnología del servidor', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('responde 404 en rutas inexistentes', async () => {
    const response = await request(createApp()).get('/api/no-existe');

    expect(response.status).toBe(404);
  });
});
