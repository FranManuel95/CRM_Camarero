import type { AccionPersonal } from "../dominio/acciones";
import type { TrabajoImpresion } from "../dominio/tipos";
import type { VistaPersonal } from "../servidor/vistas";

export type RespuestaAccion = {
  error?: string;
  /** No ha llegado al servidor (sin red): se puede guardar para mandarlo luego. */
  sinRed?: boolean;
  trabajos?: Pick<
    TrabajoImpresion,
    "id" | "estado" | "titulo" | "impresoraId" | "destino" | "tipo"
  >[];
  /** Cómo queda todo tras el cambio (así no hace falta volver a pedirlo). */
  vista?: VistaPersonal;
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
    return { error: "No hay conexión con la caja. Revisa el wifi.", sinRed: true };
  }
}
