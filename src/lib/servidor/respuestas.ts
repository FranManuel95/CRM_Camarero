import "server-only";
import { ZodError } from "zod";
import { ErrorAccion } from "../dominio/reducir";
import { almacen } from "./almacen";
import { datosDeError, registrar } from "./registro";

export const json = (datos: unknown, status = 200) =>
  Response.json(datos, { status, headers: { "Cache-Control": "no-store" } });

/** Convierte un error de una acción en una respuesta con un mensaje que se pueda enseñar. */
export function respuestaDeError(e: unknown) {
  if (e instanceof ErrorAccion) return json({ error: e.message }, 400);
  if (e instanceof ZodError) {
    const primero = e.issues[0];
    return json(
      { error: primero?.message ? `Dato no válido: ${primero.message}` : "Datos no válidos." },
      400,
    );
  }
  registrar("error", "fallo_servidor", datosDeError(e));
  return json({ error: "Algo ha fallado en el servidor. Prueba otra vez." }, 500);
}

/**
 * Flujo de eventos del servidor (SSE): cada vez que cambia algo, manda la vista nueva. El
 * navegador se reconecta solo si se corta (por ejemplo, si el móvil pierde el wifi).
 */
export function flujoDeCambios(
  request: Request,
  local: string,
  vista: () => Promise<unknown | null>,
) {
  const codificador = new TextEncoder();
  let cancelar = () => {};
  const flujo = new ReadableStream({
    start(controlador) {
      const mandar = async () => {
        const datos = await vista();
        if (datos === null) {
          controlador.enqueue(codificador.encode(`event: fin\ndata: {}\n\n`));
          return;
        }
        controlador.enqueue(codificador.encode(`data: ${JSON.stringify(datos)}\n\n`));
      };
      void mandar();
      const quitar = almacen(local).suscribirse?.(() => void mandar()) ?? (() => {});
      const latido = setInterval(
        () => controlador.enqueue(codificador.encode(`: latido\n\n`)),
        20_000,
      );
      cancelar = () => {
        quitar();
        clearInterval(latido);
        try {
          controlador.close();
        } catch {
          // ya estaba cerrado
        }
      };
      request.signal.addEventListener("abort", cancelar);
    },
    cancel() {
      cancelar();
    },
  });
  return new Response(flujo, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
