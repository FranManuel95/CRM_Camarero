import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

vi.mock("server-only", () => ({}));
const ia = await import("@/lib/servidor/ia");

const esquema = z.object({ platos: z.array(z.object({ nombre: z.string(), precio: z.number() })) });
const foto = { datos: Buffer.from("foto"), tipo: "image/jpeg" };
const peticion = { sistema: "Lee la carta.", texto: "Esta es.", archivo: foto, esquema };
const ok = { platos: [{ nombre: "Croquetas", precio: 8.5 }] };

const geminiDice = (texto: string) =>
  Response.json({ candidates: [{ content: { parts: [{ text: texto }] } }] });
const compatibleDice = (texto: string) =>
  Response.json({ choices: [{ message: { content: texto } }] });

const entorno = {
  GEMINI_API_KEY: "g",
  IA_URL: "https://ia.ejemplo/v1/",
  IA_CLAVE: "c",
  IA_MODELO: "modelo-x",
} as unknown as NodeJS.ProcessEnv;

describe("IA en cadena", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ordena los proveedores: lo gratis primero, o el orden que se pida", () => {
    expect(ia.proveedoresIa(entorno)).toEqual(["gemini", "compatible"]);
    expect(ia.proveedoresIa({ ...entorno, IA_ORDEN: "compatible" })).toEqual([
      "compatible",
      "gemini",
    ]);
    expect(ia.proveedoresIa({ ANTHROPIC_API_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toEqual([
      "anthropic",
    ]);
    expect(ia.proveedoresIa({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("si el primero está saturado, lee con el siguiente", async () => {
    const llamadas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        llamadas.push(url);
        if (url.includes("googleapis")) return new Response("cuota", { status: 429 });
        const cuerpo = JSON.parse(String(init.body));
        expect(cuerpo.model).toBe("modelo-x");
        expect(cuerpo.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
        return compatibleDice("```json\n" + JSON.stringify(ok) + "\n```");
      }),
    );
    expect(await ia.leerConIa(peticion, entorno)).toEqual(ok);
    expect(llamadas[1]).toBe("https://ia.ejemplo/v1/chat/completions");
  });

  it("si la respuesta no cumple el esquema, prueba con el siguiente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("googleapis")
          ? geminiDice('{"platos":[{"nombre":"Croquetas"}]}')
          : compatibleDice(JSON.stringify(ok)),
      ),
    );
    expect(await ia.leerConIa(peticion, entorno)).toEqual(ok);
  });

  it("todos saturados → IaSaturada; PDF sin proveedor que lo acepte → IaSinFormato", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429 })),
    );
    await expect(ia.leerConIa(peticion, entorno)).rejects.toBeInstanceOf(ia.IaSaturada);
    const pdf = { ...peticion, archivo: { datos: Buffer.from("%PDF"), tipo: "application/pdf" } };
    const soloCompatible = { ...entorno, GEMINI_API_KEY: "" } as NodeJS.ProcessEnv;
    await expect(ia.leerConIa(pdf, soloCompatible)).rejects.toBeInstanceOf(ia.IaSinFormato);
  });

  it("Gemini recibe la imagen en línea y la clave en la cabecera", async () => {
    const pedido = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      geminiDice(JSON.stringify(ok)),
    );
    vi.stubGlobal("fetch", pedido);
    expect(await ia.leerConIa(peticion, entorno)).toEqual(ok);
    const [url, init] = pedido.mock.calls[0] ?? [];
    expect(url).toContain("models/gemini-2.5-flash:generateContent");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("g");
    const cuerpo = JSON.parse(String(init?.body));
    expect(cuerpo.contents[0].parts[0].inlineData.mimeType).toBe("image/jpeg");
    expect(cuerpo.systemInstruction.parts[0].text).toContain('"platos"');
  });
});
