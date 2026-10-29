import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

test("un cliente se apunta al club desde la mesa y al cobrar suma sus puntos", async ({
  page,
  browser,
}, info) => {
  const movil = info.project.name === "movil";
  // Mesas que el bar de ejemplo ya tiene abiertas (con algo pedido).
  const [zona, mesa] = movil ? ["Salón", "Mesa 2"] : ["Terraza", "Terraza 3"];
  const nombre = movil ? "Marta Ejemplo" : "Pablo Ejemplo";
  const telefono = movil ? "600 000 031" : "600 000 032";

  await entrar(page, "1234");
  const r = await page.request.post("/api/acciones", {
    data: { accion: { tipo: "cambiar_funcion", funcion: "club", activa: true } },
  });
  expect(((await r.json()) as { error?: string }).error).toBeUndefined();

  // El cliente, desde la carta de su mesa.
  const contexto = await browser.newContext();
  const cliente = await contexto.newPage();
  await cliente.goto(`/m/local/${await tokenDeMesa(page, mesa)}`);
  await listo(cliente);
  await cliente.getByRole("link", { name: /Únete al club/ }).click();
  await cliente.getByLabel("Tu nombre").fill(nombre);
  await cliente.getByRole("textbox", { name: /^Teléfono/ }).fill(telefono);
  await cliente.getByLabel(/Acepto que La Esquina guarde/).check();
  const axe = await new AxeBuilder({ page: cliente }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await cliente.getByRole("button", { name: "Apuntarme" }).click();
  await expect(cliente.getByText(`¡Hola, ${nombre.split(" ")[0]}!`)).toBeVisible();
  await expect(cliente.getByText("10 puntos")).toBeVisible();
  await cliente.getByRole("link", { name: "Volver a la carta" }).click();
  await listo(cliente);
  await expect(
    cliente.getByText(`Esta cuenta suma puntos para ${nombre.split(" ")[0]}`),
  ).toBeVisible();
  await contexto.close();

  // En la caja se ve de quién es la cuenta y se cobra.
  await page.goto("/sala");
  await listo(page);
  await page.getByRole("tab", { name: new RegExp(zona) }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,?`) }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`${nombre.split(" ")[0]} · 10 pts`) }),
  ).toBeVisible();
  if (movil) await page.getByRole("tab", { name: /Cuenta/ }).click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: /Tarjeta/ }).click();
  await page.getByRole("button", { name: /y sacar ticket/ }).click();
  await expect(page).toHaveURL(/\/sala$/);

  // En Gestión → Clientes ya tiene su primera visita.
  await page.goto("/gestion/clientes");
  await listo(page);
  const fila = page.getByRole("row").filter({ hasText: nombre });
  await expect(fila.getByRole("cell").nth(2)).toHaveText("1");
  const axeGestion = await new AxeBuilder({ page }).analyze();
  expect(axeGestion.violations.map((v) => v.id)).toEqual([]);
  await fila.getByRole("button", { name: nombre }).click();
  await expect(page.getByRole("dialog")).toContainText("se apuntó desde el QR");
});
