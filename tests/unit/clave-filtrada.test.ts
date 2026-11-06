import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { apareceEnRango, claveFiltrada } = await import("@/lib/servidor/clave-filtrada");

const huella = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

describe("contraseñas filtradas", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("encuentra la huella en el rango y descarta el relleno", () => {
    const h = huella("contraseña-de-prueba");
    const rango = `0000000000000000000000000000000000A:3\r\n${h.slice(5)}:12\r\nFFFF:0`;
    expect(apareceEnRango(rango, h)).toBe(true);
    expect(apareceEnRango(`${h.slice(5)}:0`, h)).toBe(false);
    expect(apareceEnRango("ABC:5", h)).toBe(false);
  });

  it("solo manda los 5 primeros caracteres de la huella y no bloquea si el servicio falla", async () => {
    const h = huella("otra-de-prueba");
    const pedido = vi.fn<(url: string) => Promise<Response>>(
      async () => new Response(`${h.slice(5)}:7\n`),
    );
    vi.stubGlobal("fetch", pedido);
    expect(await claveFiltrada("otra-de-prueba")).toBe(true);
    expect(pedido.mock.calls[0]?.[0]).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );
    expect(await claveFiltrada("otra-de-prueba")).toBe(false);
  });
});
