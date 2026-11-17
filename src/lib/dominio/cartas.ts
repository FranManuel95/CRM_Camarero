import { dentroDeHorario } from "./horario";
import type { CartaHoraria, Categoria, Estado, Id } from "./tipos";

/**
 * Cartas del bar (Desayunos, Comidas, Copas…): cada una es un nombre y sus categorías, y si quien
 * la crea quiere, un horario.
 * - Sin horario: está siempre disponible; el camarero y el cliente la eligen con un botón.
 * - Con horario: solo está disponible en su franja, y entonces sale la primera.
 * Lo que no está en ninguna carta sale siempre, en todas.
 */

/** Lo que se elige ver: la carta que toca ahora, una concreta o toda. */
export type VerCarta = "ahora" | "toda" | Id;

export const MAX_CARTAS = 12;

type ConCartas = Pick<Estado, "categorias"> & { cartas?: Estado["cartas"] };

/** Cartas que se pueden usar en este momento: las que no tienen horario y las que están en hora. */
export function cartasDisponibles(estado: ConCartas, iso: string): CartaHoraria[] {
  return (estado.cartas ?? []).filter((c) => dentroDeHorario(c.horario, iso));
}

/** Cartas con horario que tocan ahora («Desayunos» a las 9). */
export function cartasAhora(estado: ConCartas, iso: string): CartaHoraria[] {
  return (estado.cartas ?? []).filter((c) => c.horario && dentroDeHorario(c.horario, iso));
}

/** La carta que se enseña primero: la que toca por horario, si no la primera disponible. */
export function cartaInicial(estado: ConCartas, iso: string): VerCarta {
  if (!estado.cartas?.length) return "toda";
  const porHora = cartasAhora(estado, iso)[0];
  if (porHora) return porHora.id;
  return cartasDisponibles(estado, iso)[0]?.id ?? "toda";
}

const asignadas = (estado: ConCartas): Set<Id> =>
  new Set((estado.cartas ?? []).flatMap((c) => c.categoriaIds));

/**
 * ¿Se sirve esta categoría ahora? Respeta su propio horario y, si hay cartas, que esté en una de
 * las disponibles (o en ninguna). Si no hay ninguna disponible y todo tiene carta, se sirve todo,
 * para que la carta nunca quede vacía.
 */
export function categoriaEnServicio(estado: ConCartas, categoria: Categoria, iso: string): boolean {
  if (!dentroDeHorario(categoria.horario, iso)) return false;
  if (!estado.cartas?.length) return true;
  const enAlguna = asignadas(estado);
  if (!enAlguna.has(categoria.id)) return true;
  const disponibles = cartasDisponibles(estado, iso);
  if (disponibles.length) return disponibles.some((c) => c.categoriaIds.includes(categoria.id));
  return estado.categorias.every((c) => enAlguna.has(c.id));
}

/** Las categorías que se ven, por orden, según la carta elegida (más las que no tienen carta). */
export function categoriasVisibles(estado: ConCartas, ver: VerCarta, iso: string): Categoria[] {
  const ordenadas = [...estado.categorias].sort((a, b) => a.orden - b.orden);
  if (ver === "toda" || !estado.cartas?.length) return ordenadas;
  const enAlguna = asignadas(estado);
  const de = (cartas: CartaHoraria[]) =>
    ordenadas.filter(
      (c) => !enAlguna.has(c.id) || cartas.some((x) => x.categoriaIds.includes(c.id)),
    );
  if (ver === "ahora") {
    const tocan = cartasAhora(estado, iso);
    return tocan.length ? de(tocan) : ordenadas.filter((c) => categoriaEnServicio(estado, c, iso));
  }
  const carta = estado.cartas.find((c) => c.id === ver);
  return carta ? de([carta]) : ordenadas;
}
