// Gate de separación de responsabilidades: las pruebas de aceptación (tests/acceptance/)
// y las pruebas E2E (tests/e2e/) solo pueden venir de commits del proceso de QA
// (mensaje que empieza por "qa(").
// El proceso de desarrollo y el de corrección no pueden modificarlas.
const { execSync } = require('node:child_process');

const base = process.env.BASE_REF;

if (!base) {
  console.log('No es un pull request: el gate no aplica en esta ejecución.');
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const commits = run(`git log --no-merges --format=%H origin/${base}..HEAD`).split('\n').filter(Boolean);

const violaciones = [];
for (const sha of commits) {
  const asunto = run(`git log -1 --format=%s ${sha}`);
  const archivos = run(`git diff-tree --no-commit-id --name-only -r ${sha}`).split('\n');
  const esDeQA = (f) => (f.startsWith('tests/acceptance/') || f.startsWith('tests/e2e/')) && !f.endsWith('.gitkeep');
  const tocaAceptacion = archivos.some(esDeQA);
  if (tocaAceptacion && !asunto.startsWith('qa(')) {
    violaciones.push(`${sha.slice(0, 7)} "${asunto}"`);
  }
}

console.log(`Commits revisados: ${commits.length}`);

if (violaciones.length > 0) {
  console.error('Gate fallido: estos commits modifican pruebas de aceptación o E2E sin venir del proceso de QA:');
  violaciones.forEach((v) => console.error(`- ${v}`));
  process.exit(1);
}

console.log('Gate aprobado: las pruebas de aceptación y E2E solo fueron modificadas por el proceso de QA.');
