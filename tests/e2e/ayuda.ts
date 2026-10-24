import { expect, type Page } from "@playwright/test";

export async function entrar(page: Page, pin = "1111") {
  await page.goto("/entrar");
  for (const cifra of pin) await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/sala/);
  await listo(page);
}

/** Espera a que la pantalla reciba los datos en directo (ya se puede tocar). */
export async function listo(page: Page) {
  await page.locator("html[data-conectado]").waitFor({ state: "attached" });
}

/** El enlace a la carta QR de una mesa, sacado de la hoja de QR (como lo haría el encargado). */
export async function tokenDeMesa(page: Page, mesa: string): Promise<string> {
  const r = await page.request.get("/api/estado");
  const estado = (await r.json()) as { mesas: { nombre: string; token: string }[] };
  return estado.mesas.find((m) => m.nombre === mesa)!.token;
}
