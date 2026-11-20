import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

const PLATO = "Tortilla de patatas (pincho)";

// El favorito se quita al final aunque la prueba falle, para no cambiar las demás.
test.afterEach(async ({ page }) => {
  const r = await page.request.get("/api/estado");
  if (!r.ok()) return;
  const estado = (await r.json()) as { productos: { id: string; nombre: string }[] };
  const p = estado.productos.find((x) => x.nombre === PLATO);
  if (p)
    await page.request.post("/api/acciones", {
      data: { accion: { tipo: "marcar_favorito", productoId: p.id, favorito: false } },
    });
});

test("un favorito sale siempre en «Rápidos» y destacado en la carta QR", async ({
  page,
  browser,
}) => {
  await entrar(page, "1234");
  await page.goto("/gestion/carta");
  await listo(page);
  await page.getByRole("button", { name: "Tapas Cocina" }).click();
  const estrella = page.getByRole("button", { name: `Favorito: ${PLATO}` });
  await estrella.click();
  await expect(estrella).toHaveAttribute("aria-pressed", "true");

  await page.goto("/sala/rapida");
  await listo(page);
  await page.getByRole("tab", { name: "Rápidos" }).click();
  await expect(page.getByRole("button", { name: `${PLATO} (favorito)` }).first()).toBeVisible();

  const token = await tokenDeMesa(page, "Mesa 2");
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(`/m/local/${token}`);
  const destacados = cliente.getByRole("region", { name: "Lo más pedido" });
  await expect(destacados.getByRole("heading", { name: PLATO })).toBeVisible();
  const axe = await new AxeBuilder({ page: cliente }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await cliente.context().close();
});
