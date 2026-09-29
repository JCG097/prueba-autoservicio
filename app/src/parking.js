// Lógica de negocio del parqueadero.
// No depende de Express: son funciones puras fáciles de probar con pruebas unitarias.

// Tarifa en pesos colombianos por hora o fracción.
const TARIFAS = { carro: 3000, moto: 1500 };

// Formato de placas en Colombia: carro ABC123, moto ABC12D.
const FORMATO_PLACA = {
  carro: /^[A-Z]{3}\d{3}$/,
  moto: /^[A-Z]{3}\d{2}[A-Z]$/,
};

class ErrorNegocio extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

function crearParqueadero({ carros = 12, motos = 6 } = {}) {
  const espacios = [];
  for (let i = 1; i <= carros; i++) {
    espacios.push({ codigo: `C-${String(i).padStart(2, '0')}`, tipo: 'carro', placa: null, ingreso: null });
  }
  for (let i = 1; i <= motos; i++) {
    espacios.push({ codigo: `M-${String(i).padStart(2, '0')}`, tipo: 'moto', placa: null, ingreso: null });
  }
  return { espacios, recibos: [] };
}

function normalizarPlaca(placa) {
  return String(placa ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
}

function verEspacio(espacio) {
  return {
    codigo: espacio.codigo,
    tipo: espacio.tipo,
    estado: espacio.placa ? 'ocupado' : 'libre',
    placa: espacio.placa,
    ingreso: espacio.ingreso,
  };
}

function registrarIngreso(parqueadero, { placa, tipo } = {}, ahora = new Date()) {
  if (!TARIFAS[tipo]) {
    throw new ErrorNegocio('Tipo de vehículo inválido. Usa "carro" o "moto".', 400);
  }
  const p = normalizarPlaca(placa);
  if (!FORMATO_PLACA[tipo].test(p)) {
    const ejemplo = tipo === 'carro' ? 'ABC123' : 'ABC12D';
    throw new ErrorNegocio(`Placa inválida para ${tipo}. Formato esperado: ${ejemplo}.`, 400);
  }
  if (parqueadero.espacios.some((e) => e.placa === p)) {
    throw new ErrorNegocio(`El vehículo ${p} ya está dentro del parqueadero.`, 409);
  }
  const libre = parqueadero.espacios.find((e) => e.tipo === tipo && !e.placa);
  if (!libre) {
    throw new ErrorNegocio(`No hay espacios libres para ${tipo}.`, 409);
  }
  libre.placa = p;
  libre.ingreso = ahora.toISOString();
  return verEspacio(libre);
}

function buscarEspacioOcupado(parqueadero, placa) {
  const p = normalizarPlaca(placa);
  const espacio = parqueadero.espacios.find((e) => e.placa === p);
  if (!espacio) {
    throw new ErrorNegocio(`El vehículo ${p || '(sin placa)'} no está en el parqueadero.`, 404);
  }
  return { p, espacio };
}

function calcularCobro(espacio, ingreso, ahora) {
  const minutos = Math.max(1, Math.ceil((ahora - new Date(ingreso)) / 60000));
  const horasCobradas = Math.ceil(minutos / 60);
  return { minutos, horasCobradas, valor: horasCobradas * TARIFAS[espacio.tipo] };
}

function registrarSalida(parqueadero, { placa } = {}, ahora = new Date()) {
  const { p, espacio } = buscarEspacioOcupado(parqueadero, placa);
  const { minutos, horasCobradas, valor } = calcularCobro(espacio, espacio.ingreso, ahora);
  const recibo = {
    placa: p,
    espacio: espacio.codigo,
    tipo: espacio.tipo,
    ingreso: espacio.ingreso,
    salida: ahora.toISOString(),
    minutos,
    horasCobradas,
    valor,
  };
  espacio.placa = null;
  espacio.ingreso = null;
  parqueadero.recibos.push(recibo);
  return recibo;
}

function consultarVehiculo(parqueadero, placa, ahora = new Date()) {
  const { p, espacio } = buscarEspacioOcupado(parqueadero, placa);
  const { minutos, valor } = calcularCobro(espacio, espacio.ingreso, ahora);
  return {
    placa: p,
    espacio: espacio.codigo,
    tipo: espacio.tipo,
    ingreso: espacio.ingreso,
    minutos,
    valor,
  };
}

function listarEspacios(parqueadero, { tipo, estado } = {}) {
  return parqueadero.espacios
    .map(verEspacio)
    .filter((e) => (!tipo || e.tipo === tipo) && (!estado || e.estado === estado));
}

function resumen(parqueadero) {
  const resultado = {};
  for (const tipo of Object.keys(TARIFAS)) {
    const delTipo = parqueadero.espacios.filter((e) => e.tipo === tipo);
    const ocupados = delTipo.filter((e) => e.placa).length;
    resultado[tipo] = { total: delTipo.length, ocupados, libres: delTipo.length - ocupados };
  }
  return resultado;
}

function reporteIngresos(parqueadero) {
  const porTipo = {};
  for (const tipo of Object.keys(TARIFAS)) {
    porTipo[tipo] = { total: 0 };
  }
  let total = 0;
  for (const recibo of parqueadero.recibos) {
    total += recibo.valor;
    porTipo[recibo.tipo].total += recibo.valor;
  }
  return { total, cantidadSalidas: parqueadero.recibos.length, porTipo };
}

module.exports = {
  TARIFAS,
  ErrorNegocio,
  crearParqueadero,
  normalizarPlaca,
  registrarIngreso,
  registrarSalida,
  consultarVehiculo,
  listarEspacios,
  resumen,
  reporteIngresos,
};
