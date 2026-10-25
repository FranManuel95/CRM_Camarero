import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

test("con VERI*FACTU, el ticket lleva el QR y su registro se ve en Gestión", async ({ page }) => {
  await entrar(page, "1234");
  await page.goto("/gestion/funciones");
  await listo(page);
  const interruptor = page.getByRole("checkbox", { name: "VERI*FACTU" });
  if (!(await interruptor.isChecked())) {
    await page.getByText("VERI*FACTU", { exact: true }).click();
    await expect(page.getByText("VERI*FACTU: encendido")).toBeVisible();
  }

  // Una caña en venta rápida.
  await page.goto("/sala/rapida");
  await listo(page);
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: /Tarjeta/ }).click();
  await page.getByRole("button", { name: /Cobrar 2,00/ }).click();
  await expect(page.getByText(/Cobrado/)).toBeVisible();

  const estado = (await (await page.request.get("/api/estado")).json()) as {
    tickets: { numero: string; urlQr?: string }[];
  };
  const ticket = estado.tickets.at(-1)!;
  expect(ticket.urlQr).toMatch(/^https:\/\/prewww2\.aeat\.es\/wlpl\/TIKE-CONT\/ValidarQR\?nif=/);

  // El certificado de las pruebas no vale: el registro queda por mandar y se explica por qué.
  await page.goto("/gestion/verifactu");
  await listo(page);
  await expect(page.getByText("Ahora va al entorno de pruebas")).toBeVisible();
  const fila = page.getByRole("row").filter({ hasText: ticket.numero });
  await expect(fila).toContainText("Por mandar");
  await expect(page.getByText(/No se ha podido conectar con la AEAT/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
