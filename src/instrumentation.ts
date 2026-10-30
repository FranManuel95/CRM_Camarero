import type { Instrumentation } from "next";

/**
 * Cualquier error sin capturar en el servidor (páginas, rutas, acciones) queda registrado en una
 * línea JSON con la ruta y el identificador que ve el usuario («digest»).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, contexto) => {
  const e = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      nivel: "error",
      suceso: "error_sin_capturar",
      metodo: request.method,
      ruta: request.path.split("?")[0],
      tipoRuta: contexto.routeType,
      digest: e.digest,
      error: e.name,
      mensaje: e.message,
      pila: e.stack?.split("\n").slice(0, 6).join("\n"),
    }),
  );
};
