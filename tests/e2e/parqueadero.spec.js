// Pruebas E2E base de la app, ejecutadas contra el ambiente de QA desplegado.
// Cada prueba usa placas distintas para no depender del estado que dejan las demás.
const { test, expect } = require('@playwright/test');

const libres = async (page, tipo) =>
  Number(await page.getByTestId(`libres-${tipo}`).textContent());

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('zona-carro')).toBeVisible();
});

test('muestra 12 espacios de carro y 6 de moto', async ({ page }) => {
  await expect(page.locator('[data-testid^="espacio-C-"]')).toHaveCount(12);
  await expect(page.locator('[data-testid^="espacio-M-"]')).toHaveCount(6);
});

test('registra el ingreso de un carro y descuenta un cupo', async ({ page }) => {
  const antes = await libres(page, 'carro');

  await page.getByTestId('placa-ingreso').fill('EEE101');
  await page.getByTestId('tipo-ingreso').selectOption('carro');
  await page.getByTestId('btn-ingreso').click();

  await expect(page.getByTestId('msg-ingreso')).toContainText('Ingreso registrado: EEE101');
  await expect(page.getByTestId('zona-carro').getByText('EEE101')).toBeVisible();
  await expect(page.getByTestId('libres-carro')).toHaveText(String(antes - 1));
});

test('rechaza una placa con formato inválido', async ({ page }) => {
  await page.getByTestId('placa-ingreso').fill('AB1');
  await page.getByTestId('btn-ingreso').click();

  await expect(page.getByTestId('msg-ingreso')).toContainText('Placa inválida');
});

test('registra la salida y muestra el recibo con el cobro', async ({ page }) => {
  await page.getByTestId('placa-ingreso').fill('SAL202');
  await page.getByTestId('tipo-ingreso').selectOption('carro');
  await page.getByTestId('btn-ingreso').click();
  await expect(page.getByTestId('msg-ingreso')).toContainText('SAL202');

  await page.getByTestId('placa-salida').fill('SAL202');
  await page.getByTestId('btn-salida').click();

  await expect(page.getByTestId('recibo')).toBeVisible();
  await expect(page.getByTestId('recibo-total')).toContainText('3.000');
});
