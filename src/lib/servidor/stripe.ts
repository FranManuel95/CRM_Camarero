import { createHmac, timingSafeEqual } from "node:crypto";
import { ErrorAccion } from "../dominio/reducir";

/**
 * Pago con tarjeta desde el QR con Stripe Checkout, sin su librería: la página de pago la pone
 * Stripe (el bar nunca ve la tarjeta) y, al pagar, Stripe avisa a /api/pago/stripe. Necesita
 * STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (los de la cuenta de Stripe del bar).
 */

const API = "https://api.stripe.com/v1";

/** Lo que va dentro del pago para saber, al volver el aviso, qué cuenta se ha pagado. */
export type DatosPago = { local: string; cuentaId: string; importe: number };

export async function crearSesionPago(datos: {
  pago: DatosPago;
  concepto: string;
  /** Adónde vuelve el cliente al pagar o al echarse atrás. */
  vuelta: string;
}): Promise<string> {
  const { pago } = datos;
  const cuerpo = new URLSearchParams({
    mode: "payment",
    locale: "es",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(pago.importe),
    "line_items[0][price_data][product_data][name]": datos.concepto,
    success_url: `${datos.vuelta}?pago=hecho`,
    cancel_url: `${datos.vuelta}?pago=cancelado`,
    // Media hora para pagar (lo mínimo que deja Stripe): luego la cuenta puede haber cambiado.
    expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
    "metadata[local]": pago.local,
    "metadata[cuentaId]": pago.cuentaId,
    "metadata[importe]": String(pago.importe),
  });
  const r = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: cuerpo,
  });
  const sesion = (await r.json()) as { url?: string; error?: { message?: string } };
  if (!r.ok || !sesion.url) {
    console.error("Stripe:", sesion.error?.message ?? r.status);
    throw new ErrorAccion(
      "Ahora mismo no se puede pagar con tarjeta aquí. Pídele la cuenta al camarero.",
    );
  }
  return sesion.url;
}

/** Margen para aceptar un aviso firmado (evita que se reenvíe uno viejo). */
const TOLERANCIA_S = 300;

/**
 * Comprueba la firma de un aviso de Stripe (cabecera «Stripe-Signature»: t=…,v1=…). Es un HMAC
 * SHA-256 de «t.cuerpo» con el secreto del webhook.
 */
export function firmaValida(
  cuerpo: string,
  cabecera: string | null,
  secreto: string,
  ahora = Date.now(),
): boolean {
  if (!cabecera || !secreto) return false;
  const partes = cabecera.split(",").map((p) => p.split("=", 2) as [string, string]);
  const t = partes.find(([k]) => k === "t")?.[1];
  const firmas = partes.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !firmas.length || Math.abs(ahora / 1000 - Number(t)) > TOLERANCIA_S) return false;
  const esperada = Buffer.from(
    createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex"),
  );
  return firmas.some((f) => {
    const recibida = Buffer.from(f);
    return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
  });
}

/** Del aviso de Stripe, el pago hecho (o null si no es un pago completado de los nuestros). */
export function pagoDelAviso(evento: unknown): (DatosPago & { referencia: string }) | null {
  const e = evento as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        amount_total?: number;
        metadata?: Record<string, string>;
      };
    };
  };
  if (
    e.type !== "checkout.session.completed" &&
    e.type !== "checkout.session.async_payment_succeeded"
  )
    return null;
  const s = e.data?.object;
  const m = s?.metadata;
  if (!s?.id || s.payment_status !== "paid" || !m?.local || !m.cuentaId) return null;
  // Lo que se ha cobrado de verdad. Si no cuadra con la cuenta, el bar lo cobra a mano.
  return { referencia: s.id, local: m.local, cuentaId: m.cuentaId, importe: s.amount_total ?? 0 };
}
