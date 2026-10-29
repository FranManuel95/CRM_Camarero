import type { Centimos, Estado, Producto } from "./tipos";

/** A cuánto se redondea el precio nuevo: nada, 5, 10 o 50 céntimos. */
export type Redondeo = 0 | 5 | 10 | 50;

/** Precio con el % aplicado y redondeado («+5 %, a 0,10 €»: 2,35 € → 2,50 €). */
export function precioNuevo(precio: Centimos, porcentaje: number, redondeo: Redondeo): Centimos {
  const bruto = precio * (1 + porcentaje / 100);
  const redondeado = redondeo ? Math.round(bruto / redondeo) * redondeo : Math.round(bruto);
  return Math.max(0, redondeado);
}

export type CambioPrecio = { producto: Producto; antes: Centimos; despues: Centimos };

/** Lo que cambiaría en esas categorías (vacío = toda la carta). Solo los que cambian. */
export function propuestaPrecios(
  estado: Pick<Estado, "productos">,
  categoriaIds: string[],
  porcentaje: number,
  redondeo: Redondeo,
): CambioPrecio[] {
  return estado.productos
    .filter((p) => !categoriaIds.length || categoriaIds.includes(p.categoriaId))
    .map((p) => ({
      producto: p,
      antes: p.precio,
      despues: precioNuevo(p.precio, porcentaje, redondeo),
    }))
    .filter((c) => c.despues !== c.antes);
}
