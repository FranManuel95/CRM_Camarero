import { describe, expect, it } from "vitest";
import { crearCopia, leerCopia } from "@/lib/dominio/copia";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { contexto } from "./ayuda";

const ctx = contexto();
const estado = estadoDeEjemplo(ctx, { conHistorial: true });

describe("copia de seguridad", () => {
  it("una copia se lee entera", () => {
    const texto = JSON.stringify(crearCopia(estado, "local", ctx.ahora));
    const copia = leerCopia(texto);
    expect(copia.estado.tickets).toHaveLength(estado.tickets.length);
    expect(copia.estado.productos).toEqual(estado.productos);
    expect(copia.local).toBe("local");
  });

  it("los tickets del ejemplo van por orden de fecha (así los carga la nube)", () => {
    const porFecha = [...estado.tickets].sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || a.secuencia - b.secuencia,
    );
    expect(porFecha.map((t) => t.id)).toEqual(estado.tickets.map((t) => t.id));
  });

  it("rechaza lo que no es una copia", () => {
    expect(() => leerCopia("hola")).toThrow(/no es una copia/);
    expect(() => leerCopia(JSON.stringify({ formato: "otra cosa" }))).toThrow(/no es una copia/);
  });

  it("rechaza una copia a la que le han quitado un ticket", () => {
    expect(estado.tickets.length).toBeGreaterThan(3);
    const sinUno = { ...estado, tickets: estado.tickets.filter((_, i) => i !== 2) };
    const texto = JSON.stringify(crearCopia(sinUno, "local", ctx.ahora));
    expect(() => leerCopia(texto)).toThrow(/cadena de tickets se rompe/);
  });
});
