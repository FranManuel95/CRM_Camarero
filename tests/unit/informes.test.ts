import { describe, expect, it } from "vitest";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { informe, inicioDelDia, rangoDeDias, sumarDias } from "@/lib/dominio/informes";
import { diaLocal } from "@/lib/fechas";
import { contexto } from "./ayuda";

describe("informes", () => {
  it("calcula la medianoche de Madrid en invierno y en verano", () => {
    expect(inicioDelDia("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
    expect(inicioDelDia("2026-07-15")).toBe("2026-07-14T22:00:00.000Z");
    expect(sumarDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(diaLocal("2026-07-14T22:30:00.000Z")).toBe("2026-07-15");
  });

  it("cuadra ventas, IVA, gastos y resultado con los datos de ejemplo", () => {
    const estado = estadoDeEjemplo(contexto(), { conHistorial: true });
    const r = informe(estado, rangoDeDias("2026-10-01", "2026-10-31"));
    expect(r.tickets).toBe(estado.tickets.length);
    expect(r.ventas).toBe(estado.tickets.reduce((s, t) => s + t.total, 0));
    expect(r.ventasBase + r.ivaRepercutido).toBe(r.ventas);
    expect(r.porDia.reduce((s, d) => s + d.ventas, 0)).toBe(r.ventas);
    expect(r.porHora.reduce((s, h) => s + h, 0)).toBe(r.ventas);
    expect(Object.values(r.porMetodo).reduce((s, v) => s + v, 0)).toBe(r.ventas);
    expect(r.gastos).toBe(estado.gastos.reduce((s, g) => s + g.importe, 0));
    expect(r.resultado).toBe(r.ventasBase - r.gastosBase);
    expect(r.productos[0]!.ventas).toBeGreaterThanOrEqual(r.productos.at(-1)!.ventas);
    expect(r.productos.every((p) => p.coste !== null)).toBe(true);
  });
});
