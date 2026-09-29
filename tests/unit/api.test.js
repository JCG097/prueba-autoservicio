const request = require('supertest');
const { crearApp } = require('../../app/src/app');

describe('API del parqueadero', () => {
  let app;

  beforeEach(() => {
    app = crearApp();
  });

  test('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'ok' });
  });

  test('POST /api/ingresos registra un vehículo', async () => {
    const res = await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe('C-01');
  });

  test('POST /api/ingresos responde 400 con placa inválida', async () => {
    const res = await request(app).post('/api/ingresos').send({ placa: 'AB1', tipo: 'carro' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch('Placa inválida');
  });

  test('responde 400 si el cuerpo no es JSON válido', async () => {
    const res = await request(app).post('/api/ingresos').set('Content-Type', 'application/json').send('{mal');
    expect(res.status).toBe(400);
  });

  test('POST /api/salidas devuelve el recibo', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    const res = await request(app).post('/api/salidas').send({ placa: 'ABC123' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ placa: 'ABC123', valor: 3000 });
  });

  test('POST /api/salidas responde 404 si el vehículo no está', async () => {
    const res = await request(app).post('/api/salidas').send({ placa: 'ZZZ999' });
    expect(res.status).toBe(404);
  });

  test('GET /api/vehiculos/:placa devuelve el espacio, tipo, ingreso y valor', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    const res = await request(app).get('/api/vehiculos/ABC123');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ placa: 'ABC123', espacio: 'C-01', tipo: 'carro' });
    expect(res.body).toHaveProperty('ingreso');
    expect(res.body).toHaveProperty('valor');
  });

  test('GET /api/vehiculos/:placa acepta la placa en minúsculas o con guion', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    const res = await request(app).get('/api/vehiculos/abc-123');
    expect(res.status).toBe(200);
    expect(res.body.placa).toBe('ABC123');
  });

  test('GET /api/vehiculos/:placa responde 404 si el vehículo no está', async () => {
    const res = await request(app).get('/api/vehiculos/ZZZ999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('El vehículo ZZZ999 no está en el parqueadero.');
  });

  test('GET /api/espacios y /api/resumen reflejan la ocupación', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    const espacios = await request(app).get('/api/espacios?estado=ocupado');
    const resumen = await request(app).get('/api/resumen');
    expect(espacios.body).toHaveLength(1);
    expect(resumen.body.carro.libres).toBe(11);
  });
});
