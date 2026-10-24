import type { AccionPersonal } from "../dominio/acciones";
import type { TrabajoImpresion } from "../dominio/tipos";

export type RespuestaAccion = {
  error?: string;
  trabajos?: Pick<
    TrabajoImpresion,
    "id" | "estado" | "titulo" | "impresoraId" | "destino" | "tipo"
  >[];
};

export async function enviarAccion(accion: AccionPersonal): Promise<RespuestaAccion> {
  try {
    const r = await fetch("/api/acciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion }),
    });
    if (r.status === 401) {
      // Recarga completa a propósito: la sesión ha cambiado y hay que empezar de cero.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/entrar?vuelta=${encodeURIComponent(window.location.pathname)}`);
      return { error: "Tu sesión ha caducado." };
    }
    return (await r.json()) as RespuestaAccion;
  } catch {
    return { error: "No hay conexión con la caja. Revisa el wifi." };
  }
}
