/**
 * Reseñas en Google lo más rápido posible: el QR lleva al cliente directamente a la ventana de
 * las estrellas de la ficha del bar, sin tener que buscarla.
 *
 * Vale pegar el enlace de «Pedir reseñas» de Google Business («https://g.page/r/…/review»), el
 * de cualquier otra web de opiniones, o el identificador de la ficha (Place ID, «ChIJ…»), con
 * el que se arma el enlace directo a escribir la reseña.
 */

const PLACE_ID = /^[A-Za-z0-9_-]{20,}$/;

/** Convierte lo que pega el encargado en el enlace de la reseña, o null si no vale. */
export function enlaceDeResena(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (PLACE_ID.test(limpio) && !limpio.includes("."))
    return `https://search.google.com/local/writereview?placeid=${limpio}`;
  try {
    const url = new URL(limpio);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** ¿Lleva directamente a escribir la reseña (y no solo a la ficha)? */
export function esEnlaceDirecto(enlace: string): boolean {
  return /writereview|\/review\b|g\.page\/r\//.test(enlace);
}
