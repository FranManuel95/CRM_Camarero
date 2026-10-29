import { describe, expect, it } from "vitest";
import { apuntarTiempos, informeTiempos } from "@/lib/dominio/tiempos";
import type { Estado, LineaCuenta } from "@/lib/dominio/tipos";

const linea = (nombre: string, enviadaEn: string, cantidad = 1): LineaCuenta =>
  ({ id: nombre, nombre, cantidad, destino: "cocina", enviadaEn }) as LineaCuenta;

describe("tiempos de cocina", () => {
  it("resume por día y plato, y descarta lo que se olvidó marcar", () => {
    const estado = { tiemposCocina: [] } as unknown as Estado;
    apuntarTiempos(estado, [linea("Croquetas", "2026-10-20T12:00:00Z", 2)], "2026-10-20T12:10:00Z");
    apuntarTiempos(estado, [linea("Croquetas", "2026-10-20T13:00:00Z")], "2026-10-20T13:16:00Z");
    apuntarTiempos(estado, [linea("Bravas", "2026-10-20T13:00:00Z")], "2026-10-20T17:00:00Z");
    expect(estado.tiemposCocina).toHaveLength(1);
    const { media, veces, filas } = informeTiempos(
      estado.tiemposCocina,
      "2026-10-20",
      "2026-10-20",
    );
    expect(veces).toBe(3);
    expect(media).toBe(12);
    expect(filas[0]).toMatchObject({ producto: "Croquetas", maximo: 16 });
    expect(informeTiempos(estado.tiemposCocina, "2026-10-21", "2026-10-31").veces).toBe(0);
  });
});
