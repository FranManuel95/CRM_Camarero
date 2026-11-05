import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

test("se da de alta una impresora de cualquier tipo y la prueba sale (o se ve por qué no)", async ({
  page,
}, info) => {
  test.skip(info.project.name === "movil", "Basta con una vez: cambia las impresoras de todos.");
  await entrar(page, "1234");
  await page.goto("/gestion/impresoras");
  await listo(page);

  // Una en un puerto del ordenador del bar: aquí imprime el propio servidor (no hace falta puente).
  await page.getByRole("button", { name: "Añadir impresora" }).click();
  const dialogo = page.getByRole("dialog", { name: "Añadir impresora" });
  await dialogo.getByLabel("Nombre").fill("Caja por puerto");
  await dialogo.getByText("Por USB o Bluetooth a un ordenador del bar").click();
  await expect(dialogo.getByRole("radio", { name: /a un ordenador del bar/ })).toBeChecked();
  await dialogo.getByRole("button", { name: /En un puerto/ }).click();
  await dialogo.getByLabel(/^Puerto/).fill("/dev/null");
  const axe = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Impresora guardada")).toBeVisible();
  const fila = page.getByRole("listitem").filter({ hasText: "Caja por puerto" });
  await expect(fila).toContainText("Puerto /dev/null del ordenador del puente");
  await fila.getByRole("button", { name: "Imprimir prueba" }).click();
  const cola = page.getByRole("region", { name: "Lo último que se ha impreso" });
  await expect(
    cola.getByRole("listitem").filter({ hasText: "Prueba · Caja por puerto" }).first(),
  ).toContainText("Impreso");

  // Un puerto que no es un puerto no se acepta.
  await fila.getByRole("button", { name: "Editar Caja por puerto" }).click();
  const editar = page.getByRole("dialog", { name: "Editar impresora" });
  await editar.getByLabel(/^Puerto/).fill("/etc/passwd");
  await editar.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/El puerto es como COM3/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await editar.getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByRole("button", { name: "Editar Caja por puerto" })).toHaveCount(0);

  // Una conectada a una pantalla: se enlaza en «Esta pantalla».
  await page.getByRole("button", { name: "Añadir impresora" }).click();
  await dialogo.getByLabel("Nombre").fill("Tablet barra");
  await dialogo.getByText(/Por USB o Bluetooth a una tablet/).click();
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  const pantalla = page.getByRole("region", { name: "Esta pantalla" });
  const enlace = pantalla.getByRole("listitem").filter({ hasText: "Tablet barra" });
  await expect(enlace).toContainText("no conectada aquí");
  await enlace.getByRole("button", { name: /Diálogo de imprimir/ }).click();
  await enlace.getByRole("button", { name: "Usar el diálogo" }).click();
  await expect(enlace).toContainText("conectada aquí por el diálogo de imprimir");
  const fila2 = page.getByRole("listitem").filter({ hasText: "Tablet barra" }).first();
  await fila2.getByRole("button", { name: "Editar Tablet barra" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("dialog", { name: "Editar impresora" })
    .getByRole("button", { name: "Quitar" })
    .click();
  await expect(page.getByRole("button", { name: "Editar Tablet barra" })).toHaveCount(0);
});
