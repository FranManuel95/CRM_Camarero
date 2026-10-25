import "server-only";
import { enlaceResena, ErrorAccion } from "../dominio/reducir";
import type { Estado, Ticket } from "../dominio/tipos";
import { aTexto } from "../impresion/documento";
import { plantillaTicket } from "../impresion/plantillas";

/**
 * Ticket por correo con Resend (RESEND_API_KEY y CORREO_REMITENTE, p. ej. «La Esquina
 * <tickets@dominio-del-bar.es>»). El correo del cliente no se guarda: se usa para mandar y ya.
 */

const escapar = (texto: string) =>
  texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** El ticket tal cual sale en el papel, en texto y en HTML. */
export function correoDeTicket(estado: Estado, ticket: Ticket) {
  const documento = plantillaTicket({
    ajustes: estado.ajustes,
    ticket,
    camarero: estado.empleados.find((e) => e.id === ticket.empleadoId),
  }).filter((b) => b.tipo !== "corte" && b.tipo !== "qr");
  const texto = aTexto(documento, 42).trimEnd();
  const resena = enlaceResena(estado);
  const local = estado.ajustes.nombreLocal;
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5">
<div style="max-width:420px;margin:0 auto;background:#fff;padding:20px;border-radius:12px">
<pre style="font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;margin:0">${escapar(texto)}</pre>
${resena ? `<p style="font:15px system-ui,sans-serif;text-align:center;margin:20px 0 0"><a href="${escapar(resena)}">¿Qué tal? Déjanos tu opinión</a></p>` : ""}
</div></body></html>`;
  return {
    asunto: `Tu ticket de ${local} (${ticket.numero})`,
    texto: resena ? `${texto}\n\n¿Qué tal? Déjanos tu opinión: ${resena}` : texto,
    html,
  };
}

export async function mandarTicket(estado: Estado, ticket: Ticket, para: string) {
  const correo = correoDeTicket(estado, ticket);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CORREO_REMITENTE,
      to: [para],
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    }),
  });
  if (!r.ok) {
    console.error("Resend:", r.status, await r.text().catch(() => ""));
    throw new ErrorAccion(
      "No se ha podido mandar el correo. Revisa la dirección y prueba otra vez.",
    );
  }
}
