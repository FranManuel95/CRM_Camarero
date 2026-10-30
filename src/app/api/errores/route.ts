import { z } from "zod";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";

export const dynamic = "force-dynamic";

// Un aparato con un fallo en bucle no debe llenar los registros.
const porIp = crearLimite(20, 10 * 60_000);

const informe = z.object({
  mensaje: z.string().max(500),
  pila: z.string().max(2000).optional(),
  ruta: z.string().max(200),
  digest: z.string().max(100).optional(),
});

/** Los errores que pasan en las pantallas (móviles, tablets) llegan aquí y se registran. */
export async function POST(request: Request) {
  if (!porIp(ipDe(request))) return new Response(null, { status: 429 });
  const texto = await request.text();
  if (texto.length > 4000) return new Response(null, { status: 413 });
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // no es JSON
  }
  const datos = informe.safeParse(cuerpo);
  if (!datos.success) return new Response(null, { status: 400 });
  registrar("error", "error_pantalla", {
    ...datos.data,
    // La ruta sin lo que va detrás de «?» (puede llevar códigos).
    ruta: datos.data.ruta.split("?")[0],
    navegador: request.headers.get("user-agent")?.slice(0, 160),
  });
  return new Response(null, { status: 204 });
}
