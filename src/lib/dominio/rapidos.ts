import { horaLocal } from "../fechas";
import type { Ticket } from "./tipos";

/** Días que se miran para saber qué se pide más. */
const DIAS = 28;

/**
 * Los productos que más se piden a esta hora (una hora arriba o abajo) en las últimas semanas,
 * para tenerlos a un toque. Si a esa hora hay poco, los más pedidos del día entero.
 * Devuelve nombres de producto de la carta, del más pedido al menos.
 */
export function masPedidos(tickets: Ticket[], ahora: string, cuantos = 12): string[] {
  const desde = new Date(Date.parse(ahora) - DIAS * 86_400_000).toISOString();
  const hora = horaLocal(ahora);
  const recientes = tickets.filter((t) => t.fecha >= desde && t.fecha <= ahora && t.total > 0);
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
