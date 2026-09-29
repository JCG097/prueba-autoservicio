const request = require('supertest');
const { crearApp } = require('../../app/src/app');

// Issue #1: Bloquear espacios por mantenimiento.
//
// Los criterios no especifican el formato exacto del cuerpo de la respuesta
// de bloqueo/desbloqueo. Se elige la interpretación más literal: el cuerpo
// es el espacio actualizado, con el mismo formato que devuelve GET
// /api/espacios (incluye un campo `estado`).
describe('Issue #1: Bloquear espacios por mantenimiento', () => {
  let app;

  beforeEach(() => {
    app = crearApp();
  });

  // Criterio: dado el espacio libre C-03, cuando lo bloqueo con
  // POST /api/espacios/C-03/bloqueo, entonces responde 200 y el espacio
  // queda en estado "mantenimiento".
  test('bloquear el espacio libre C-03 responde 200 y el espacio queda en estado "mantenimiento"', async () => {
    const res = await request(app).post('/api/espacios/C-03/bloqueo');

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('mantenimiento');

    const espacios = await request(app).get('/api/espacios');
    const c03 = espacios.body.find((e) => e.codigo === 'C-03');
    expect(c03.estado).toBe('mantenimiento');
  });

  // Criterio: dado que C-01 y C-02 están ocupados y C-03 está en
  // mantenimiento, cuando registro el ingreso de un carro, entonces se le
  // asigna C-04.
  test('con C-01 y C-02 ocupados y C-03 en mantenimiento, el siguiente ingreso de carro se asigna a C-04', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'AAA111', tipo: 'carro' });
    await request(app).post('/api/ingresos').send({ placa: 'BBB222', tipo: 'carro' });
    await request(app).post('/api/espacios/C-03/bloqueo');

    const res = await request(app).post('/api/ingresos').send({ placa: 'CCC333', tipo: 'carro' });

    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe('C-04');
  });

  // Criterio: dado el espacio ocupado C-01, cuando intento bloquearlo,
  // entonces responde 409 con el mensaje "El espacio C-01 está ocupado."
  test('bloquear el espacio ocupado C-01 responde 409 con el mensaje "El espacio C-01 está ocupado."', async () => {
    await request(app).post('/api/ingresos').send({ placa: 'DDD444', tipo: 'carro' });

    const res = await request(app).post('/api/espacios/C-01/bloqueo');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('El espacio C-01 está ocupado.');
  });

  // Criterio: dado un espacio en mantenimiento, cuando lo desbloqueo con
  // DELETE /api/espacios/C-03/bloqueo, entonces responde 200 y vuelve a
  // estado "libre".
  test('desbloquear un espacio en mantenimiento con DELETE responde 200 y vuelve a estado "libre"', async () => {
    await request(app).post('/api/espacios/C-03/bloqueo');

    const res = await request(app).delete('/api/espacios/C-03/bloqueo');

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('libre');

    const espacios = await request(app).get('/api/espacios');
    const c03 = espacios.body.find((e) => e.codigo === 'C-03');
    expect(c03.estado).toBe('libre');
  });
});
