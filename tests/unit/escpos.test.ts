import { describe, expect, it } from "vitest";
import { aTexto, lineaPar, partirTexto } from "@/lib/impresion/documento";
import { aEscpos, codificarTexto } from "@/lib/impresion/escpos";

describe("documento de impresión", () => {
  it("parte el texto sin cortar palabras", () => {
    expect(partirTexto("Croquetas de jamón caseras", 12)).toEqual([
      "Croquetas de",
      "jamón",
      "caseras",
    ]);
    expect(partirTexto("Supercalifragilístico", 8)).toEqual(["Supercal", "ifragilí", "stico"]);
  });

  it("pone el importe a la derecha", () => {
    expect(lineaPar("2 Caña", "4,00 €", 20)).toEqual(["2 Caña        4,00 €"]);
    const larga = lineaPar("1 Hamburguesa La Esquina (Al punto, Bacon)", "13,00 €", 32);
    expect(larga.at(-1)?.endsWith("13,00 €")).toBe(true);
    expect(larga.every((l) => l.length <= 32)).toBe(true);
  });

  it("genera la vista previa", () => {
    const texto = aTexto(
      [
        { tipo: "texto", texto: "MESA 4", alinear: "centro", grande: true },
        { tipo: "separador" },
        { tipo: "par", izquierda: "TOTAL", derecha: "9,50 €" },
      ],
      32,
    );
    expect(texto.split("\n")).toEqual([
      "     MESA 4",
      "-".repeat(32),
      "TOTAL" + " ".repeat(21) + "9,50 €",
    ]);
  });
});

describe("ESC/POS", () => {
  it("codifica tildes, eñes y el euro en la página 858", () => {
    expect(codificarTexto("ñÑ€áé¿")).toEqual([0xa4, 0xa5, 0xd5, 0xa0, 0x82, 0xa8]);
    expect(codificarTexto("ĉ✂")).toEqual([0x63, 0x2d]);
  });

  it("empieza inicializando, corta y abre el cajón", () => {
    const bytes = Array.from(
      aEscpos(
        [{ tipo: "cajon" }, { tipo: "texto", texto: "Hola", negrita: true }, { tipo: "corte" }],
        { columnas: 48 },
      ),
    );
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 19]);
    expect(bytes.slice(5, 10)).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
    const texto = String.fromCharCode(...bytes);
    expect(texto).toContain("\x1bE\x01Hola\n\x1bE\x00");
  });

  it("incluye el QR con su longitud", () => {
    const bytes = Array.from(
      aEscpos([{ tipo: "qr", datos: "https://ejemplo.invalid" }], { columnas: 48 }),
    );
    const i = bytes.findIndex((b, k) => b === 0x1d && bytes[k + 6] === 0x50);
    expect(bytes[i + 3]).toBe("https://ejemplo.invalid".length + 3);
  });
});
