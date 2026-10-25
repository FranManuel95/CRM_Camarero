"use client";

import type { AccionPersonal } from "../dominio/acciones";

/**
 * Lo que el aparato ha hecho sin red y aún no ha llegado al servidor. Se guarda en el propio
 * aparato (aguanta aunque se cierre la app) y se manda en orden cuando vuelve la conexión.
 */
export type Pendiente = { id: string; en: string; accion: AccionPersonal };

/** Lo único que se puede hacer sin red: el servicio de sala y cocina. Cobrar o anular, no. */
export const SE_PUEDE_SIN_RED = new Set<AccionPersonal["tipo"]>([
  "abrir_cuenta",
  "abrir_para_llevar",
  "anotar",
  "enviar_comanda",
  "marchar",
  "marcar_lista",
  "volver_a_preparar",
  "marcar_servida",
  "atender_aviso",
  "cambiar_comensales",
]);

const clave = (empleadoId: string) => `comanda.sin-red.${empleadoId}`;
const oyentes = new Set<() => void>();
const cache = new Map<string, Pendiente[]>();
const VACIA: Pendiente[] = [];

export function leerPendientes(empleadoId: string): Pendiente[] {
  if (cache.has(empleadoId)) return cache.get(empleadoId)!;
  let lista = VACIA;
  try {
    const texto = localStorage.getItem(clave(empleadoId));
    if (texto) lista = JSON.parse(texto) as Pendiente[];
  } catch {
    lista = VACIA;
  }
  cache.set(empleadoId, lista);
  return lista;
}

function guardar(empleadoId: string, lista: Pendiente[]) {
  cache.set(empleadoId, lista);
  try {
    if (lista.length) localStorage.setItem(clave(empleadoId), JSON.stringify(lista));
    else localStorage.removeItem(clave(empleadoId));
  } catch {
    // Sin almacenamiento (modo privado): se queda en memoria mientras la pantalla siga abierta.
  }
  oyentes.forEach((f) => f());
}

export function suscribirPendientes(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Guarda una acción para mandarla luego. Al abrir mesa, le pone ya su identificador. */
export function apuntarPendiente(empleadoId: string, accion: AccionPersonal): Pendiente {
  const conId: AccionPersonal =
    accion.tipo === "abrir_cuenta" && !accion.cuentaId
      ? { ...accion, cuentaId: `sr-${nuevoId()}` }
      : accion;
  const p = { id: nuevoId(), en: new Date().toISOString(), accion: conId };
  guardar(empleadoId, [...leerPendientes(empleadoId), p]);
  return p;
}

export function quitarPendiente(empleadoId: string, id: string) {
  guardar(
    empleadoId,
    leerPendientes(empleadoId).filter((p) => p.id !== id),
  );
}
