import type { Ajustes, Empleado, Permiso } from "./tipos";

export const NOMBRE_PERMISO: Record<Permiso, { nombre: string; detalle: string }> = {
  cobrar: { nombre: "Cobrar", detalle: "Cobrar mesas, ventas rápidas y deudas." },
  anular: { nombre: "Anular", detalle: "Anular lo que ya está en cocina o barra." },
  invitar: { nombre: "Invitar", detalle: "Poner algo como invitación de la casa." },
  descuentos: { nombre: "Precios y descuentos", detalle: "Cambiar precios y hacer descuentos." },
  caja: { nombre: "Caja", detalle: "Abrir y cerrar la caja, y meter o sacar dinero." },
};

export const LISTA_PERMISOS = Object.keys(NOMBRE_PERMISO) as Permiso[];

/**
 * ¿Puede hacerlo? El encargado, siempre. Un camarero, lo que tenga marcado; si no se ha tocado,
 * todo menos los descuentos cuando el bar los deja solo al encargado.
 */
export function puede(
  ajustes: Pick<Ajustes, "preciosSoloEncargado">,
  empleado: Pick<Empleado, "rol" | "permisos">,
  permiso: Permiso,
): boolean {
  if (empleado.rol === "encargado") return true;
  const marcado = empleado.permisos?.[permiso];
  if (marcado !== undefined) return marcado;
  return permiso === "descuentos" ? !ajustes.preciosSoloEncargado : true;
}
