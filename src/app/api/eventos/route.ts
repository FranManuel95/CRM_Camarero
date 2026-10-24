import { leerEstado } from "@/lib/servidor/almacen";
import { flujoDeCambios, json } from "@/lib/servidor/respuestas";
import { empleadoActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const empleado = await empleadoActual();
  if (!empleado) return json({ error: "Entra con tu PIN." }, 401);
  return flujoDeCambios(request, () => {
    // Si a alguien le desactivan mientras tiene la pantalla abierta, deja de recibir datos.
    const estado = leerEstado();
    return estado.empleados.some((e) => e.id === empleado.id && e.activo)
      ? vistaPersonal(estado)
      : null;
  });
}
