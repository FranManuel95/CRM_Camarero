import { leerEstado } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { crearSesionPago } from "@/lib/servidor/stripe";
import { vistaCliente } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

const porIp = crearLimite(10, 10 * 60_000);

type Params = { params: Promise<{ local: string; token: string }> };

/**
 * Prepara el pago con tarjeta de lo que queda en la cuenta y devuelve la página de pago de
 * Stripe. El importe lo calcula el servidor, nunca el móvil.
 */
export async function POST(request: Request, { params }: Params) {
  const { local, token } = await params;
  if (!porIp(ipDe(request)))
    return json({ error: "Vas muy rápido. Espera un poco y vuelve a probar." }, 429);
  try {
    const estado = await leerEstado(local);
    const vista = vistaCliente(estado, token);
    if (!vista) return json({ error: "Este QR ya no es válido." }, 404);
    if (!vista.local.pagoQR)
      return json(
        { error: "Aquí no se puede pagar con el móvil. Pídele la cuenta al camarero." },
        400,
      );
    const importe = vista.cuenta?.aPagar ?? 0;
    if (!importe)
      return json(
        { error: "Ahora mismo no hay nada que pagar (o falta que acepten tu pedido)." },
        400,
      );
    const cuenta =
      estado.cuentas.find((c) => c.llevar?.token === token && c.estado === "abierta") ??
      estado.cuentas.find(
        (c) =>
          c.estado === "abierta" &&
          estado.mesas.some((m) => m.token === token && m.id === c.mesaId),
      );
    if (!cuenta) return json({ error: "Ahora mismo no hay nada que pagar." }, 400);
    const url = await crearSesionPago({
      pago: { local, cuentaId: cuenta.id, importe },
      concepto: `${vista.local.nombre} · ${vista.mesa.nombre}`,
      vuelta: `${new URL(request.url).origin}/m/${local}/${token}`,
    });
    return json({ ok: true, url });
  } catch (e) {
    return respuestaDeError(e);
  }
}
