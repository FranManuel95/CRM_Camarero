import { dentroDeHorario } from "./horario";
import type { Estado, Producto, Tarifa } from "./tipos";

/**
 * Precios por horario y zona: el precio de un producto ahora y en esa zona, con los cambios que
 * tocan (happy hour, recargo de terraza…). Si hay varios, se aplican uno detrás de otro.
 */
export function tarifasQueTocan(
  tarifas: Tarifa[] | undefined,
  producto: Pick<Producto, "categoriaId">,
  zonaId: string | null,
  ahora: string,
): Tarifa[] {
  return (tarifas ?? []).filter(
    (t) =>
      t.activa &&
      t.porcentaje !== 0 &&
      (!t.categoriaIds.length || t.categoriaIds.includes(producto.categoriaId)) &&
      (!t.zonaIds.length || (zonaId !== null && t.zonaIds.includes(zonaId))) &&
      dentroDeHorario(t.horario, ahora),
  );
}

/** Precio de la carta con las tarifas que tocan, y sus nombres (para enseñarlo en la línea). */
export function precioConTarifa(
  estado: Pick<Estado, "ajustes">,
  producto: Pick<Producto, "precio" | "categoriaId">,
  zonaId: string | null,
  ahora: string,
): { precio: number; tarifa?: string } {
  const tocan = tarifasQueTocan(estado.ajustes.tarifas, producto, zonaId, ahora);
  if (!tocan.length) return { precio: producto.precio };
  const precio = tocan.reduce(
    (p, t) => Math.max(0, Math.round((p * (100 + t.porcentaje)) / 100)),
    producto.precio,
  );
  return { precio, tarifa: tocan.map((t) => t.nombre).join(" + ") };
}

/** «−20 %», «+10 %». */
export const textoPorcentaje = (p: number) => `${p > 0 ? "+" : "−"}${Math.abs(p)} %`;
