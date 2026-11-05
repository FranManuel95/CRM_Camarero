import { createServer as crearHttp } from "node:http";
import { createServer as crearTcp } from "node:net";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { accionPersonal } from "@/lib/dominio/acciones";
import { alertasEncargado } from "@/lib/dominio/alertas";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { RUTA_PUERTO } from "@/lib/dominio/impresoras";
import { reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

vi.mock("server-only", () => ({}));
const salidas = await import("@/lib/servidor/salidas");
// El puente que se descarga el bar: tiene que hacer lo mismo que el servidor.
type Puente = Pick<
  typeof salidas,
  "enviarPorRed" | "escribirEnPuerto" | "enviarAPuerto" | "ordenSistema" | "POWERSHELL_RAW"
> & {
  VERSION: string;
  crearPuente(
    direccion: string,
    clave: string,
    opciones?: { usarDirecto?: boolean },
  ): { vuelta(): Promise<void>; latido(): Promise<void>; detener(): void };
};
// @ts-expect-error -- el puente es un archivo JavaScript suelto, sin tipos.
const puente = (await import("../../public/puente-impresion.mjs")) as Puente;

const ctx = contexto();

/** Una impresora de red de mentira: guarda lo que le llega. */
function impresoraDeRed() {
  const recibido: Buffer[] = [];
  const servidor = crearTcp((s) => s.on("data", (d: Buffer) => recibido.push(d)));
  return new Promise<{ puerto: number; recibido: () => Buffer; cerrar: () => void }>((ok) =>
    servidor.listen(0, "127.0.0.1", () =>
      ok({
        puerto: (servidor.address() as { port: number }).port,
        recibido: () => Buffer.concat(recibido),
        cerrar: () => servidor.close(),
      }),
    ),
  );
}

describe("puertos válidos", () => {
  it("acepta COM y aparatos de /dev, y nada más", () => {
    for (const bien of ["COM3", "COM12", "/dev/rfcomm0", "/dev/usb/lp0", "/dev/cu.Printer-SPP"])
      expect(RUTA_PUERTO.test(bien)).toBe(true);
    for (const mal of ["COM0", "C:\\datos.json", "/etc/passwd", "/dev/../etc/passwd", "lp0", ""])
      expect(RUTA_PUERTO.test(mal)).toBe(false);
  });

  it("la acción rechaza un puerto que no es un puerto", () => {
    const accion = {
      tipo: "guardar_impresora",
      impresora: {
        nombre: "Caja",
        conexion: "puerto",
        ip: "",
        puerto: 9100,
        rutaPuerto: "/home/bar/estado.json",
        baudios: 9600,
        columnas: 48,
        imprimeCocina: false,
        imprimeBarra: false,
        imprimeTickets: true,
        abreCajon: true,
        activa: true,
      },
    };
    expect(accionPersonal.safeParse(accion).success).toBe(false);
    accion.impresora.rutaPuerto = "COM5";
    expect(accionPersonal.safeParse(accion).success).toBe(true);
  });
});

describe("salidas del ordenador del bar (servidor y puente)", () => {
  const bytes = Uint8Array.from([0x1b, 0x40, 0x48, 0x6f, 0x6c, 0x61, 0x0a]);

  it("por red llegan los bytes tal cual", async () => {
    for (const enviar of [salidas.enviarPorRed, puente.enviarPorRed]) {
      const imp = await impresoraDeRed();
      await enviar("127.0.0.1", imp.puerto, bytes);
      await new Promise((r) => setTimeout(r, 50));
      expect([...imp.recibido()]).toEqual([...bytes]);
      imp.cerrar();
    }
  });

  it("por red, si no contesta, se dice claro", async () => {
    await expect(salidas.enviarPorRed("127.0.0.1", 1, bytes, 500)).rejects.toThrow(
      /rechaza|contesta/,
    );
  });

  it("a un puerto se escribe en él", async () => {
    const carpeta = mkdtempSync(path.join(os.tmpdir(), "puerto-"));
    for (const [i, escribir] of [salidas.escribirEnPuerto, puente.escribirEnPuerto].entries()) {
      const ruta = path.join(carpeta, `lp${i}`);
      await escribir(ruta, bytes);
      expect([...readFileSync(ruta)]).toEqual([...bytes]);
    }
    await expect(
      salidas.escribirEnPuerto(path.join(carpeta, "no", "existe"), bytes),
    ).rejects.toThrow(/No existe el puerto/);
  });

  it("no se escribe en algo que no sea un puerto", async () => {
    await expect(salidas.enviarAPuerto("/etc/passwd", 9600, bytes)).rejects.toThrow(/no vale/);
    await expect(puente.enviarAPuerto("/etc/passwd", 9600, bytes)).rejects.toThrow(/no vale/);
  });

  it("a una impresora instalada, en bruto: Windows por su cola, Mac y Linux con lp", () => {
    for (const orden of [salidas.ordenSistema, puente.ordenSistema]) {
      const [win, argsWin] = orden(
        "EPSON TM-T20II Receipt",
        "C:\\t\\x.bin",
        "C:\\t\\raw.ps1",
        "win32",
      );
      expect(win).toBe("powershell.exe");
      // El nombre va como parámetro, nunca dentro del código.
      expect(argsWin).toEqual(
        expect.arrayContaining(["-File", "C:\\t\\raw.ps1", "-Impresora", "EPSON TM-T20II Receipt"]),
      );
      expect(orden("Cocina", "/tmp/x.bin", "", "linux")).toEqual([
        "lp",
        ["-d", "Cocina", "-o", "raw", "/tmp/x.bin"],
      ]);
    }
    expect(puente.POWERSHELL_RAW).toBe(salidas.POWERSHELL_RAW);
  });

  it("cada impresora sabe por dónde se le manda", () => {
    const base = {
      id: "x",
      nombre: "X",
      ip: "",
      puerto: 9100,
      columnas: 48,
      imprimeCocina: true,
      imprimeBarra: false,
      imprimeTickets: false,
      abreCajon: false,
      activa: true,
    };
    expect(salidas.salidaDe({ ...base, conexion: "red", ip: "10.0.0.9" })).toEqual({
      via: "red",
      ip: "10.0.0.9",
      puerto: 9100,
    });
    expect(salidas.salidaDe({ ...base, conexion: "sistema", nombreSistema: "Caja" })).toEqual({
      via: "sistema",
      nombre: "Caja",
    });
    expect(salidas.salidaDe({ ...base, conexion: "puerto", rutaPuerto: "COM4" })).toEqual({
      via: "puerto",
      ruta: "COM4",
      baudios: 9600,
    });
    expect(salidas.salidaDe({ ...base, conexion: "navegador" })).toBeNull();
  });
});

describe("el puente, de principio a fin", () => {
  it("pregunta, imprime, cuenta cómo ha ido y dice qué impresoras ve", async () => {
    const imp = await impresoraDeRed();
    const recibidos: unknown[] = [];
    let preguntas = 0;
    const app = crearHttp((req, res) => {
      expect(req.headers.authorization).toBe("Bearer local.clave");
      expect(req.headers["x-puente"]).toBe(puente.VERSION);
      if (req.method === "GET") {
        preguntas++;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            version: puente.VERSION,
            trabajos:
              preguntas === 1
                ? [
                    {
                      id: "t1",
                      titulo: "Comanda Mesa 2",
                      impresora: "Cocina",
                      salida: { via: "red", ip: "127.0.0.1", puerto: imp.puerto },
                      datos: Buffer.from("hola").toString("base64"),
                    },
                  ]
                : [],
          }),
        );
        return;
      }
      let cuerpo = "";
      req.on("data", (d) => (cuerpo += d));
      req.on("end", () => {
        recibidos.push(JSON.parse(cuerpo));
        res.end("{}");
      });
    });
    await new Promise<void>((ok) => app.listen(0, "127.0.0.1", ok));
    const direccion = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const p = puente.crearPuente(direccion, "local.clave", { usarDirecto: false });
    await p.vuelta();
    await p.latido();
    await new Promise((r) => setTimeout(r, 100));
    expect(imp.recibido().toString()).toBe("hola");
    expect(recibidos).toContainEqual({ id: "t1", ok: true });
    expect(recibidos).toContainEqual({
      latido: expect.objectContaining({ version: puente.VERSION, sistema: expect.any(Array) }),
    });
    p.detener();
    imp.cerrar();
    app.close();
  });
});

describe("cola de impresión con cualquier conexión", () => {
  function preparar() {
    let estado: Estado = estadoDeEjemplo(ctx);
    const [ana] = estado.empleados as [Empleado];
    const hacer = (accion: AccionPersonal) => {
      const r = reducirPersonal(estado, accion, ana, ctx);
      estado = r.estado;
      return r;
    };
    return {
      get estado() {
        return estado;
      },
      hacer,
    };
  }
  const impresora = (conexion: "sistema" | "puerto" | "navegador", extra = {}) => ({
    nombre: `Impresora ${conexion}`,
    conexion,
    ip: "",
    puerto: 9100,
    columnas: 48,
    imprimeCocina: true,
    imprimeBarra: true,
    imprimeTickets: true,
    abreCajon: false,
    activa: true,
    ...extra,
  });

  it("las del ordenador del puente se imprimen solas; las de pantalla esperan a su pantalla", () => {
    const t = preparar();
    t.estado.impresoras = [];
    t.hacer({
      tipo: "guardar_impresora",
      impresora: impresora("sistema", { nombreSistema: "EPSON TM-T20II" }),
    });
    t.hacer({ tipo: "guardar_impresora", impresora: impresora("navegador") });
    const [sistema, pantalla] = t.estado.impresoras;
    expect(t.hacer({ tipo: "imprimir_prueba", impresoraId: sistema!.id }).trabajos[0]!.estado).toBe(
      "pendiente",
    );
    const r = t.hacer({ tipo: "imprimir_prueba", impresoraId: pantalla!.id });
    expect(r.trabajos[0]!.estado).toBe("en_navegador");

    // Si falla en la pantalla, al reintentar vuelve a esperar a su pantalla.
    t.estado.trabajos = t.estado.trabajos.map((x) =>
      x.id === r.trabajos[0]!.id ? { ...x, estado: "error", error: "Sin papel" } : x,
    );
    const otra = t.hacer({ tipo: "reintentar_trabajo", trabajoId: r.trabajos[0]!.id });
    expect(otra.trabajos[0]).toMatchObject({ estado: "en_navegador" });
    expect(otra.trabajos[0]!.error).toBeUndefined();
  });

  it("sin el dato que toca, no se guarda", () => {
    const t = preparar();
    expect(() => t.hacer({ tipo: "guardar_impresora", impresora: impresora("sistema") })).toThrow(
      /Elige la impresora/,
    );
    expect(() => t.hacer({ tipo: "guardar_impresora", impresora: impresora("puerto") })).toThrow(
      /Elige el puerto/,
    );
  });

  it("si algo se atasca o falla, el encargado se entera", () => {
    const t = preparar();
    const hace = (min: number) => new Date(Date.parse(ctx.ahora) - min * 60_000).toISOString();
    t.estado.impresoras = [
      { ...impresora("sistema", { nombreSistema: "X" }), id: "imp-c", nombre: "Cocina" },
    ];
    t.estado.puente = {
      visto: hace(30),
      version: "2",
      so: "windows",
      sistema: [],
      puertos: [],
    };
    t.estado.trabajos = [
      {
        id: "a",
        creadoEn: hace(5),
        tipo: "comanda",
        impresoraId: "imp-c",
        titulo: "Comanda",
        documento: [],
        estado: "pendiente",
      },
      {
        id: "b",
        creadoEn: hace(10),
        tipo: "ticket",
        impresoraId: "imp-c",
        titulo: "Ticket",
        documento: [],
        estado: "error",
        error: "Sin papel",
      },
    ];
    const textos = alertasEncargado(t.estado, ctx.ahora).map((a) => a.texto);
    expect(textos).toContain(
      "No está saliendo nada por Cocina: el puente de impresión no da señales.",
    );
    expect(textos.some((x) => x.startsWith("Ha fallado 1 impresión (Cocina)"))).toBe(true);
  });
});
