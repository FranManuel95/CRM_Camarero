import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// En entornos con Chromium preinstalado (p. ej. contenedores CI) se usa ese binario.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const launchOptions = existsSync(chromiumPath) ? { executablePath: chromiumPath } : {};
const port = Number(process.env.PORT ?? 3100);
// Cada ejecución arranca con los datos de ejemplo recién creados.
const datos = mkdtempSync(path.join(tmpdir(), "comanda-e2e-"));

export default defineConfig({
  testDir: "tests/e2e",
  // Las pruebas comparten el mismo bar: van de una en una para no pisarse las mesas.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", launchOptions },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"], launchOptions } },
  ],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // TPV_CLAVE vacía: las pruebas usan siempre el archivo local, nunca la base de datos real.
    env: {
      DATOS_DIR: datos,
      TPV_CLAVE: "",
      // VERI*FACTU con un certificado que no vale: se puede encender y ver qué pasa si el envío
      // falla, sin llegar nunca a la AEAT. Datos del fabricante inventados.
      VERIFACTU_CERTIFICADO: Buffer.from("no es un certificado").toString("base64"),
      VERIFACTU_PRODUCTOR_NIF: "B00000001",
      VERIFACTU_PRODUCTOR_NOMBRE: "Fabricante Ficticio, S.L.",
    },
  },
});
