const { test, expect } = require('@playwright/test');

// Issue #1: Bloquear espacios por mantenimiento.
//
// Criterio: "En el mapa del parqueadero, un espacio en mantenimiento muestra
// el texto 'Mantenimiento' en lugar de 'Libre'." Los criterios no incluyen un
// control de interfaz para bloquear el espacio, así que se bloquea por API
// antes de cargar la página y se verifica el texto que muestra el mapa para
// ese espacio. Se usa C-12 (el último espacio de carro) para no interferir
// con los espacios que asignan otras pruebas E2E, y se desbloquea al final.
test('un espacio en mantenimiento muestra el texto "Mantenimiento" en lugar de "Libre" en el mapa', async ({ page }) => {
  const codigo = 'C-12';

  await page.request.post(`/api/espacios/${codigo}/bloqueo`);

  try {
    await page.goto('/');
    const espacio = page.getByTestId(`espacio-${codigo}`);
    await expect(espacio).toContainText('Mantenimiento');
    await expect(espacio).not.toContainText('Libre');
  } finally {
    await page.request.delete(`/api/espacios/${codigo}/bloqueo`);
  }
});
