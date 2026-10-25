import { z } from "zod";
import { leerEstado } from "@/lib/servidor/almacen";
import { mandarTicket } from "@/lib/servidor/correo";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { vistaCliente } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

const porMesa = crearLimite(3, 10 * 60_000);
const porIp = crearLimite(5, 10 * 60_000);

type Params = { params: Promise<{ local: string; token: string }> };

/** El cliente pide el ticket de lo que acaba de pagar en su correo. */
export async function POST(request: Request, { params }: Params) {
  const { local, token } = await params;
  if (!porMesa(`${local}/${token}`) || !porIp(ipDe(request)))
    return json({ error: "Ya te lo hemos mandado. Mira en tu correo (y en el spam)." }, 429);
  try {
    const { correo } = z
      .object({ correo: z.email("Ese correo no parece bien escrito.").max(200) })
      .parse(await request.json());
    const estado = await leerEstado(local);
    const vista = vistaCliente(estado, token);
    if (!vista?.local.ticketCorreo || !vista.ticket)
      return json({ error: "Ahora no hay ningún ticket que mandar." }, 400);
    const ticket = estado.tickets.find((t) => t.id === vista.ticket!.id)!;
    await mandarTicket(estado, ticket, correo);
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
