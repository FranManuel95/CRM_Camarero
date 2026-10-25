import { almacen, leerEstado } from "@/lib/servidor/almacen";
import { flujoDeCambios, json } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

/** Cambios en directo cuando el servidor está en el bar (en la nube los avisa Supabase Realtime). */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Entra con tu PIN." }, 401);
  const { local, empleado } = sesion;
  if (!almacen(local).suscribirse) return json({ error: "Usa Supabase Realtime." }, 404);
  return flujoDeCambios(request, local, async () => {
    // Si a alguien le desactivan mientras tiene la pantalla abierta, deja de recibir datos.
    const estado = await leerEstado(local);
    return estado.empleados.some((e) => e.id === empleado.id && e.activo)
      ? vistaPersonal(estado, local, empleado)
      : null;
  });
}
