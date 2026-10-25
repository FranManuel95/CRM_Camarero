import { expect, test } from "@playwright/test";
import { entrar } from "./ayuda";

type Estado = {
  mesas: { id: string; nombre: string }[];
  cuentas: {
    id: string;
    mesaId: string;
    estado: string;
    lineas: { nombre: string; cantidad: number }[];
  }[];
};

test("sin wifi se abre mesa y se anota; al volver la red se manda solo", async ({
  page,
  context,
}, info) => {
  const mesa = info.project.name === "movil" ? "Mesa 1" : "Mesa 4";
  await entrar(page);
  await page.getByRole("tab", { name: "Salón" }).click();

  await context.setOffline(true);
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByText(/Sin wifi: guardado en este móvil/)).toBeVisible();
  await expect(page.getByRole("heading", { name: mesa })).toBeVisible();
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await expect(
    page.getByText("Sin conexión: 2 cosas guardadas en este aparato.", { exact: false }),
  ).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Ya está mandado lo que se guardó sin wifi")).toBeVisible({
    timeout: 20_000,
  });
  const estado = (await (await page.request.get("/api/estado")).json()) as Estado;
  const idMesa = estado.mesas.find((m) => m.nombre === mesa)!.id;
  const cuenta = estado.cuentas.find((c) => c.mesaId === idMesa && c.estado === "abierta")!;
  expect(cuenta.lineas.map((l) => [l.nombre, l.cantidad])).toEqual([["Caña", 1]]);

  // Se deja la mesa libre para el resto de pruebas.
  await page.request.post("/api/acciones", {
    data: { accion: { tipo: "anular_cuenta", cuentaId: cuenta.id } },
  });
});
