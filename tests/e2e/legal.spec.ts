import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, tokenDeMesa } from "./ayuda";

test("el aviso legal del bar se abre desde sus páginas y se lee bien", async ({ page }) => {
  await entrar(page);
  const token = await tokenDeMesa(page, "Mesa 1");
  await page.goto(`/m/local/${token}`);
  await page.getByRole("link", { name: "Aviso legal y privacidad" }).click();
  await expect(page).toHaveURL(/\/m\/local\/legal$/);
  await expect(page.getByRole("heading", { name: "Privacidad" })).toBeVisible();
  await expect(page.getByText(/Responsable de tus datos: .*B00000000/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.goto("/legal");
  await expect(page.getByRole("heading", { name: "Cookies" })).toBeVisible();
});
