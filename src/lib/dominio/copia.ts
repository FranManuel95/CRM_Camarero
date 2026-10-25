import { verificarCadena } from "./huella";
import { migrar } from "./migraciones";
import { ErrorAccion } from "./reducir";
import type { Estado } from "./tipos";

/** Copia de seguridad completa de un bar: el estado con todos los tickets y fichajes. */
export type Copia = {
  formato: "comanda-copia";
  creadaEn: string;
  local: string;
  estado: Estado;
};

export function crearCopia(estado: Estado, local: string, ahora: string): Copia {
  return { formato: "comanda-copia", creadaEn: ahora, local, estado };
}

/**
 * Lee una copia y la pone al día. Rechaza lo que no sea una copia de Comanda y las copias cuya
 * cadena de tickets no cuadra (alguien ha tocado o quitado tickets a mano).
 */
export function leerCopia(texto: string): Copia {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorAccion("Ese archivo no es una copia de Comanda.");
  }
  const copia = datos as Partial<Copia>;
  const e = copia?.estado as Partial<Estado> | undefined;
  if (
    copia?.formato !== "comanda-copia" ||
    !e ||
    typeof e.version !== "number" ||
    !Array.isArray(e.tickets) ||
    !Array.isArray(e.productos) ||
    !Array.isArray(e.empleados)
  )
    throw new ErrorAccion("Ese archivo no es una copia de Comanda.");
  const estado = migrar(e as Estado);
  // La cadena va en el orden en que se hicieron los tickets, que es como se guardan.
  const roto = verificarCadena(estado.tickets);
  if (roto) throw new ErrorAccion(`La copia no vale: la cadena de tickets se rompe en ${roto}.`);
  if (!estado.empleados.some((x) => x.activo && x.rol === "encargado"))
    throw new ErrorAccion("La copia no tiene ningún encargado activo.");
  return { ...(copia as Copia), estado };
}
