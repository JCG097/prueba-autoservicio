# Reglas de desarrollo: Parqueadero Central

Esta app se construye con dos procesos de IA separados que trabajan desde la misma historia de usuario (Issue):

- **Proceso de QA:** crea las pruebas de aceptación automatizadas a partir de los criterios de aceptación.
- **Proceso de desarrollo:** implementa el código para que esas pruebas pasen.

Cada ejecución recibe en su instrucción el rol que cumple. Sigue solo las reglas de tu rol y las reglas comunes.

## Proyecto

- Node.js 24 + Express, CommonJS (`require`), sin TypeScript.
- `app/src/parking.js`: toda la lógica de negocio, como funciones puras. Recibe la fecha como parámetro (`ahora`) para que sea testeable.
- `app/src/app.js`: solo rutas HTTP y manejo de errores. `crearApp()` devuelve la app sin arrancar el servidor.
- `app/public/index.html`: interfaz. Todo elemento nuevo con el que un usuario interactúe o que muestre un resultado lleva `data-testid`.
- Los errores de negocio se lanzan con `ErrorNegocio(mensaje, status)`.
- Mensajes para el usuario en español, claros y accionables.

## Rol QA: pruebas de aceptación y E2E

- Escribe las pruebas de aceptación de API en `tests/acceptance/issue-N.test.js`.
- Si algún criterio involucra la interfaz, escribe también pruebas E2E con Playwright en `tests/e2e/issue-N.spec.js`. Usa solo selectores `data-testid` (`page.getByTestId`). Si necesitas un `data-testid` que no existe, úsalo igual con un nombre claro: el proceso de desarrollo lo agregará. Las pruebas E2E se ejecutan en el ambiente de QA del pipeline, no en tu ejecución.
- Cada prueba E2E usa placas propias y no depende del estado que dejen otras pruebas.
- Deriva el comportamiento esperado **únicamente de los criterios de aceptación**, nunca del código existente. Si un criterio es ambiguo, elige la interpretación más literal y déjala explicada en un comentario.
- Al menos una prueba por criterio. El nombre de cada prueba cita el criterio que valida.
- Prueba a nivel de API con `supertest` y `crearApp()` de `app/src/app.js`.
- Ejecuta `npx jest tests/acceptance` y confirma que las pruebas nuevas fallan porque la funcionalidad no existe (no por errores de sintaxis).
- Un solo commit: `qa(#N): pruebas de aceptación`.
- No modifiques nada fuera de `tests/acceptance/` y `tests/e2e/`.

## Rol desarrollo: TDD

- Las pruebas de `tests/acceptance/` y `tests/e2e/` son la especificación. **Nunca las modifiques.** Si crees que una es incorrecta, no la cambies: explícalo en el PR para revisión humana.
- Trabaja con TDD en commits separados:
  1. `test(#N): pruebas unitarias en rojo`, en `tests/unit/`, para la lógica nueva de `parking.js`.
  2. `feat(#N): <resumen>`: el código mínimo para que pasen las pruebas unitarias y las de aceptación, incluidos los `data-testid` que usen las pruebas E2E.
  3. `refactor(#N): <resumen>`: solo si mejora el código sin cambiar el comportamiento.
- Solo modificas `app/` y `tests/unit/`.

## Antes de cada push (ambos roles)

- `npm run lint` sin errores.
- En desarrollo, además, `npm run test:coverage` en verde con cobertura mínima del 80 %.

## Prohibido (ambos roles)

- Modificar `.github/`, `jest.config.js`, `eslint.config.js`, `sonar-project.properties`, `scripts/` o `CLAUDE.md`.
- Bajar umbrales, borrar pruebas, usar `.skip`/`.only` o desactivar reglas de lint para pasar un gate.
- Cambiar comportamiento existente que la historia no pide.
- Agregar dependencias nuevas sin que la historia lo requiera.

## Pull requests (rol desarrollo)

- Rama: `claude/issue-N` (la crea el proceso de QA).
- Título: `#N <título de la historia>`.
- Cuerpo: resumen de lo implementado, tabla de criterios con la prueba de aceptación que los valida y la línea `Closes #N`.
