const {
  crearParqueadero,
  normalizarPlaca,
  registrarIngreso,
  registrarSalida,
  consultarVehiculo,
  listarEspacios,
  resumen,
  reporteIngresos,
  bloquearEspacio,
  desbloquearEspacio,
} = require('../../app/src/parking');

// Fecha fija para que las pruebas de cobro sean repetibles.
const INGRESO = new Date('2026-10-01T08:00:00Z');
const minutosDespues = (min) => new Date(INGRESO.getTime() + min * 60000);

describe('normalizarPlaca', () => {
  test('convierte a mayúsculas y quita espacios y guiones', () => {
    expect(normalizarPlaca(' abc-123 ')).toBe('ABC123');
  });

  test('normaliza placas con espacios internos', () => {
    expect(normalizarPlaca('abc 123')).toBe('ABC123');
  });

  test('devuelve texto vacío si no hay placa', () => {
    expect(normalizarPlaca(undefined)).toBe('');
  });
});

describe('registrarIngreso', () => {
  test('asigna el primer espacio libre de carro', () => {
    const parq = crearParqueadero();
    const espacio = registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    expect(espacio).toMatchObject({ codigo: 'C-01', estado: 'ocupado', placa: 'ABC123' });
  });

  test('asigna espacio de moto con placa de moto', () => {
    const parq = crearParqueadero();
    const espacio = registrarIngreso(parq, { placa: 'XYZ12A', tipo: 'moto' }, INGRESO);
    expect(espacio.codigo).toBe('M-01');
  });

  test('rechaza un tipo de vehículo inválido', () => {
    const parq = crearParqueadero();
    expect(() => registrarIngreso(parq, { placa: 'ABC123', tipo: 'bus' })).toThrow('Tipo de vehículo inválido');
  });

  test.each([
    ['AB1', 'carro'],
    ['ABC12D', 'carro'],
    ['ABC123', 'moto'],
  ])('rechaza la placa %s para %s', (placa, tipo) => {
    const parq = crearParqueadero();
    expect(() => registrarIngreso(parq, { placa, tipo })).toThrow('Placa inválida');
  });

  test('rechaza un vehículo que ya está dentro', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' });
    expect(() => registrarIngreso(parq, { placa: 'abc 123', tipo: 'carro' })).toThrow('ya está dentro');
  });

  test('rechaza el ingreso cuando no hay cupos', () => {
    const parq = crearParqueadero({ carros: 1, motos: 0 });
    registrarIngreso(parq, { placa: 'AAA111', tipo: 'carro' });
    expect(() => registrarIngreso(parq, { placa: 'BBB222', tipo: 'carro' })).toThrow('No hay espacios libres');
  });
});

describe('registrarSalida', () => {
  test('cobra una hora mínima aunque la estadía sea corta', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    const recibo = registrarSalida(parq, { placa: 'ABC123' }, minutosDespues(10));
    expect(recibo).toMatchObject({ minutos: 10, horasCobradas: 1, valor: 3000 });
  });

  test('cobra por hora o fracción', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    const recibo = registrarSalida(parq, { placa: 'ABC123' }, minutosDespues(61));
    expect(recibo).toMatchObject({ horasCobradas: 2, valor: 6000 });
  });

  test('aplica la tarifa de moto', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'XYZ12A', tipo: 'moto' }, INGRESO);
    const recibo = registrarSalida(parq, { placa: 'XYZ12A' }, minutosDespues(120));
    expect(recibo.valor).toBe(3000);
  });

  test('libera el espacio al salir', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    registrarSalida(parq, { placa: 'ABC123' }, minutosDespues(30));
    expect(listarEspacios(parq, { estado: 'ocupado' })).toHaveLength(0);
  });

  test('rechaza la salida de un vehículo que no está', () => {
    const parq = crearParqueadero();
    expect(() => registrarSalida(parq, { placa: 'ZZZ999' })).toThrow('no está en el parqueadero');
  });
});

describe('consultarVehiculo', () => {
  test('devuelve el espacio, tipo, ingreso y valor acumulado', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    const info = consultarVehiculo(parq, 'ABC123', minutosDespues(61));
    expect(info).toMatchObject({
      placa: 'ABC123',
      espacio: 'C-01',
      tipo: 'carro',
      ingreso: INGRESO.toISOString(),
      valor: 6000,
    });
  });

  test('acepta la placa en minúsculas o con guion', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    const info = consultarVehiculo(parq, 'abc-123', minutosDespues(10));
    expect(info).toMatchObject({ placa: 'ABC123', espacio: 'C-01' });
  });

  test('rechaza una placa que no está en el parqueadero', () => {
    const parq = crearParqueadero();
    expect(() => consultarVehiculo(parq, 'ZZZ999')).toThrow(
      'El vehículo ZZZ999 no está en el parqueadero.',
    );
  });
});

describe('listarEspacios y resumen', () => {
  test('filtra por tipo y estado', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' });
    expect(listarEspacios(parq, { tipo: 'moto' })).toHaveLength(6);
    expect(listarEspacios(parq, { tipo: 'carro', estado: 'ocupado' })).toHaveLength(1);
  });

  test('cuenta cupos libres y ocupados por tipo', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' });
    expect(resumen(parq)).toEqual({
      carro: { total: 12, ocupados: 1, libres: 11 },
      moto: { total: 6, ocupados: 0, libres: 6 },
    });
  });
});

describe('bloquearEspacio', () => {
  test('bloquea un espacio libre y queda en estado "mantenimiento"', () => {
    const parq = crearParqueadero();
    const espacio = bloquearEspacio(parq, 'C-03');
    expect(espacio).toMatchObject({ codigo: 'C-03', estado: 'mantenimiento' });
  });

  test('un espacio en mantenimiento no se asigna en un nuevo ingreso', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'AAA111', tipo: 'carro' }, INGRESO);
    registrarIngreso(parq, { placa: 'BBB222', tipo: 'carro' }, INGRESO);
    bloquearEspacio(parq, 'C-03');

    const espacio = registrarIngreso(parq, { placa: 'CCC333', tipo: 'carro' }, INGRESO);

    expect(espacio.codigo).toBe('C-04');
  });

  test('rechaza bloquear un espacio ocupado', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    expect(() => bloquearEspacio(parq, 'C-01')).toThrow('El espacio C-01 está ocupado.');
  });

  test('rechaza bloquear un espacio que no existe', () => {
    const parq = crearParqueadero();
    expect(() => bloquearEspacio(parq, 'C-99')).toThrow('El espacio C-99 no existe.');
  });
});

describe('desbloquearEspacio', () => {
  test('desbloquea un espacio en mantenimiento y vuelve a estado "libre"', () => {
    const parq = crearParqueadero();
    bloquearEspacio(parq, 'C-03');

    const espacio = desbloquearEspacio(parq, 'C-03');

    expect(espacio).toMatchObject({ codigo: 'C-03', estado: 'libre' });
  });

  test('rechaza desbloquear un espacio que no existe', () => {
    const parq = crearParqueadero();
    expect(() => desbloquearEspacio(parq, 'C-99')).toThrow('El espacio C-99 no existe.');
  });
});

describe('reporteIngresos', () => {
  test('suma el total y la cantidad de salidas registradas', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    registrarSalida(parq, { placa: 'ABC123' }, minutosDespues(10));
    registrarIngreso(parq, { placa: 'XYZ12A', tipo: 'moto' }, INGRESO);
    registrarSalida(parq, { placa: 'XYZ12A' }, minutosDespues(10));

    expect(reporteIngresos(parq)).toMatchObject({ total: 4500, cantidadSalidas: 2 });
  });

  test('devuelve total 0 y cantidad 0 cuando no hay salidas', () => {
    const parq = crearParqueadero();
    expect(reporteIngresos(parq)).toEqual({
      total: 0,
      cantidadSalidas: 0,
      porTipo: { carro: { total: 0 }, moto: { total: 0 } },
    });
  });

  test('separa los ingresos por tipo de vehículo', () => {
    const parq = crearParqueadero();
    registrarIngreso(parq, { placa: 'ABC123', tipo: 'carro' }, INGRESO);
    registrarSalida(parq, { placa: 'ABC123' }, minutosDespues(10));
    registrarIngreso(parq, { placa: 'XYZ789', tipo: 'carro' }, INGRESO);
    registrarSalida(parq, { placa: 'XYZ789' }, minutosDespues(10));
    registrarIngreso(parq, { placa: 'ABC12D', tipo: 'moto' }, INGRESO);
    registrarSalida(parq, { placa: 'ABC12D' }, minutosDespues(10));

    expect(reporteIngresos(parq).porTipo).toEqual({
      carro: { total: 6000 },
      moto: { total: 1500 },
    });
  });
});
