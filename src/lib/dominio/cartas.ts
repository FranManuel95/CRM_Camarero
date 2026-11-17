import { dentroDeHorario } from "./horario";
import type { Categoria, Estado, Id } from "./tipos";

/**
 * Cartas por horario (desayuno, mediodía, cena…): cada una con su franja y sus categorías. Lo que
 * no está en ninguna carta sale siempre. Valen para la carta QR (fuera de su carta no sale ni se
 * puede pedir) y para el camarero (ve primero la carta que toca, pero puede ver toda).
 */

/** Lo que el camarero elige ver: la carta de ahora, una concreta o toda. */
export type VerCarta = "ahora" | "toda" | Id;

export const MAX_CARTAS = 12;

type ConCartas = Pick<Estado, "categorias"> & { cartas?: Estado["cartas"] };

/** Las cartas cuyo horario está abierto en este momento. */
export function cartasAhora(estado: ConCartas, iso: string) {
  return (estado.cartas ?? []).filter((c) => dentroDeHorario(c.horario, iso));
}

/** Categorías que no están en ninguna carta: salen siempre. */
function enAlgunaCarta(estado: ConCartas): Set<Id> {
  return new Set((estado.cartas ?? []).flatMap((c) => c.categoriaIds));
}

/**
 * ¿Se sirve esta categoría ahora? Respeta su propio horario y, si hay cartas, que esté en una
 * de las que tocan (o en ninguna). Si a esta hora no toca ninguna carta, sale todo lo que no
 * tiene carta; y si eso es nada, toda la carta, para que nunca quede vacía.
 */
export function categoriaEnServicio(estado: ConCartas, categoria: Categoria, iso: string): boolean {
  if (!dentroDeHorario(categoria.horario, iso)) return false;
  if (!estado.cartas?.length) return true;
  const asignadas = enAlgunaCarta(estado);
  if (!asignadas.has(categoria.id)) return true;
  const activas = cartasAhora(estado, iso);
  if (activas.length) return activas.some((c) => c.categoriaIds.includes(categoria.id));
  // Entre cartas (por ejemplo, a media tarde) y todo tiene carta: se enseña todo.
  return estado.categorias.every((c) => asignadas.has(c.id));
}

/** Las categorías que se ven, por orden, según lo elegido. */
export function categoriasVisibles(estado: ConCartas, ver: VerCarta, iso: string): Categoria[] {
  const ordenadas = [...estado.categorias].sort((a, b) => a.orden - b.orden);
  if (ver === "toda" || !estado.cartas?.length) return ordenadas;
  if (ver === "ahora") return ordenadas.filter((c) => categoriaEnServicio(estado, c, iso));
  const carta = estado.cartas.find((c) => c.id === ver);
  if (!carta) return ordenadas;
  const asignadas = enAlgunaCarta(estado);
  return ordenadas.filter((c) => carta.categoriaIds.includes(c.id) || !asignadas.has(c.id));
}
