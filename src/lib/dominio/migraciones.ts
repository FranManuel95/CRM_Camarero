import { resumenPin } from "./pin";
import type { Estado } from "./tipos";

export const VERSION_ESTADO = 3;

/** Pone al día un estado guardado con una versión anterior del programa. */
export function migrar(estado: Estado): Estado {
  let e = estado;
  if (e.version === 1) {
    // Versión 2: los PIN se guardan resumidos.
    e = { ...e, version: 2, empleados: e.empleados.map((x) => ({ ...x, pin: resumenPin(x.pin) })) };
  }
  if (e.version === 2) {
    // Versión 3: stock (ingredientes y movimientos del almacén).
    e = { ...e, version: 3, ingredientes: [], movimientosStock: [] };
  }
  if (e.version !== VERSION_ESTADO)
    throw new Error(`Datos de una versión desconocida (${e.version}).`);
  return e;
}
