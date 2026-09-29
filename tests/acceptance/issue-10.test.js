const request = require('supertest');
const { crearApp } = require('../../app/src/app');

// Issue #10: Reporte de ingresos del día.
//
// Los criterios de aceptación no especifican el nombre exacto de los campos
// para "separar los ingresos por tipo de vehículo: carro y moto". Se elige la
// interpretación más literal: la respuesta incluye un objeto `porTipo` con una
// clave por cada tipo de vehículo ("carro" y "moto"), cada una con el total de
// ingresos generado por ese tipo.
describe('Issue #10: Reporte de ingresos del día', () => {
  let app;

  beforeEach(() => {
    app = crearApp();
  });

  // Criterio: salidas de un carro por $3,000 y una moto por $1,500 -> total 4500, cantidad 2.
  test('con una salida de carro ($3,000) y una de moto ($1,500), el reporte responde 200 con total 4500 y cantidad 2', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    await request(app).post('/api/salidas').send({ placa: 'ABC123' });

    await request(app).post('/api/ingresos').send({ placa: 'ABC12D', tipo: 'moto' });
    await request(app).post('/api/salidas').send({ placa: 'ABC12D' });

    const res = await request(app).get('/api/reportes/ingresos');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4500);
    expect(res.body.cantidadSalidas).toBe(2);
  });

  // Criterio: sin salidas registradas -> total 0, cantidad 0.
  test('sin salidas registradas, el reporte responde 200 con total 0 y cantidad 0', async () => {
    const res = await request(app).get('/api/reportes/ingresos');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.cantidadSalidas).toBe(0);
  });

  // Criterio: el reporte separa los ingresos por tipo de vehículo (carro y moto).
  test('el reporte separa los ingresos por tipo de vehículo: carro y moto', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'ABC123', tipo: 'carro' });
    await request(app).post('/api/salidas').send({ placa: 'ABC123' });

    await request(app).post('/api/ingresos').send({ placa: 'XYZ789', tipo: 'carro' });
    await request(app).post('/api/salidas').send({ placa: 'XYZ789' });

    await request(app).post('/api/ingresos').send({ placa: 'ABC12D', tipo: 'moto' });
    await request(app).post('/api/salidas').send({ placa: 'ABC12D' });

    const res = await request(app).get('/api/reportes/ingresos');

    expect(res.status).toBe(200);
    expect(res.body.porTipo.carro.total).toBe(6000);
    expect(res.body.porTipo.moto.total).toBe(1500);
  });
});
