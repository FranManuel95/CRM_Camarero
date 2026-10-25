import { after } from "next/server";
import { ejecutarPagoOnline } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { firmaValida, pagoDelAviso } from "@/lib/servidor/stripe";
import { enviarVerifactu } from "@/lib/servidor/verifactu";

export const dynamic = "force-dynamic";

/**
 * Aviso de Stripe al completarse un pago desde el QR. Solo vale con la firma del webhook; un
 * mismo pago avisado dos veces se apunta una sola (ver reducirPagoOnline).
 */
export async function POST(request: Request) {
  const cuerpo = await request.text();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!firmaValida(cuerpo, request.headers.get("stripe-signature"), secreto))
    return json({ error: "Firma no válida." }, 400);
  const pago = pagoDelAviso(JSON.parse(cuerpo));
  if (!pago) return json({ ok: true, ignorado: true });
  try {
    const { local, ...datos } = pago;
    await ejecutarPagoOnline(local, datos);
    after(() => enviarVerifactu(local));
    return json({ ok: true });
  } catch (e) {
    // Stripe lo reintenta solo si no contestamos 2xx.
    console.error("Pago online:", e);
    return json({ error: "No se ha podido apuntar el pago." }, 500);
  }
}
