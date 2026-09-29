// Gate de TDD: si un PR modifica el código de la app, también debe modificar las pruebas.
const { execSync } = require('node:child_process');

const base = process.env.BASE_REF;

if (!base) {
  console.log('No es un pull request: el gate de TDD no aplica en esta ejecución.');
  process.exit(0);
}

const cambios = execSync(`git diff --name-only origin/${base}...HEAD`, { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const codigo = cambios.filter((f) => f.startsWith('app/'));
const pruebas = cambios.filter((f) => f.startsWith('tests/'));

console.log(`Código de la app modificado: ${codigo.length ? codigo.join(', ') : 'ninguno'}`);
console.log(`Pruebas modificadas: ${pruebas.length ? pruebas.join(', ') : 'ninguna'}`);

if (codigo.length > 0 && pruebas.length === 0) {
  console.error('Gate de TDD fallido: hay cambios en el código de la app sin cambios en las pruebas.');
  process.exit(1);
}

console.log('Gate de TDD aprobado.');
