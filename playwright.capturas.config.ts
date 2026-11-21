import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Saca las capturas de la ayuda (`npm run capturas`): una por pregunta del manual, con el botón
 * del que hablan los pasos señalado. Usa el mismo servidor con datos de ejemplo que las pruebas.
 */
export default defineConfig({
  ...base,
  testDir: "tests/capturas",
  retries: 0,
  projects: [
    {
      name: "capturas",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1.5,
        launchOptions: base.use?.launchOptions,
      },
    },
  ],
});
