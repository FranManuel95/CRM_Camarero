import { horaLocal } from "../fechas";
import type { Ticket } from "./tipos";

/** Días que se miran para saber qué se pide más. */
const DIAS = 28;

/**
 * Los productos que más se piden a esta hora (una hora arriba o abajo) en las últimas semanas,
 * para tenerlos a un toque. Si a esa hora hay poco, los más pedidos del día entero.
 * Devuelve nombres de producto de la carta, del más pedido al menos.
 */
export function masPedidos(
  tickets: Ticket[],
  ahora: string,
  cuantos = 12,
  /** Solo lo de los tickets de esta persona. */
  empleadoId?: string,
): string[] {
  const desde = new Date(Date.parse(ahora) - DIAS * 86_400_000).toISOString();
  const hora = horaLocal(ahora);
  const recientes = tickets.filter(
    (t) =>
      t.fecha >= desde &&
      t.fecha <= ahora &&
      t.total > 0 &&
      (!empleadoId || t.empleadoId === empleadoId),
  );
  const contar = (lista: Ticket[]) => {
    const veces = new Map<string, number>();
    for (const t of lista)
      for (const l of t.lineas)
        if (l.cantidad > 0) veces.set(l.producto, (veces.get(l.producto) ?? 0) + l.cantidad);
    return [...veces.entries()].sort((a, b) => b[1] - a[1]).map(([nombre]) => nombre);
  };
  const cerca = recientes.filter((t) => {
    const d = Math.abs(horaLocal(t.fecha) - hora);
    return Math.min(d, 24 - d) <= 1;
  });
  const aEstaHora = contar(cerca);
  const lista = aEstaHora.length >= cuantos / 2 ? aEstaHora : contar(recientes);
  return lista.slice(0, cuantos);
}

/** Cuántos de «lo que más pide cada uno» entran en su pestaña «Rápidos». */
export const MAX_SUYOS = 6;
export const MAX_RAPIDOS = 16;

/**
 * La pestaña «Rápidos» de cada camarero: primero los favoritos que fija el encargado (siempre),
 * después lo que más pide esa persona y luego lo más pedido en el bar a esta hora. Sin repetir.
 */
export function mezclarRapidos(listas: {
  favoritos: string[];
  suyos: string[];
  bar: string[];
  max?: number;
}): string[] {
  const max = listas.max ?? MAX_RAPIDOS;
  const vistos = new Set<string>();
  const salida: string[] = [];
  const meter = (nombres: string[], tope: number) => {
    let puestos = 0;
    for (const n of nombres) {
      if (salida.length >= max || puestos >= tope) return;
      if (vistos.has(n)) continue;
      vistos.add(n);
      salida.push(n);
      puestos++;
    }
  };
  meter(listas.favoritos, max);
  meter(listas.suyos, MAX_SUYOS);
  meter(listas.bar, max);
  return salida;
}
