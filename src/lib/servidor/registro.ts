import "server-only";

/**
 * Registro del servidor: una línea JSON por suceso, para buscar y filtrar en los logs de Vercel
 * (por bar, por tipo de acción, por lo que tarda…). Nunca datos personales: ni nombres, ni
 * teléfonos, ni correos; los bares van por su identificador.
 */
export type Nivel = "info" | "aviso" | "error";

export function registrar(nivel: Nivel, suceso: string, datos: Record<string, unknown> = {}) {
  const linea = JSON.stringify({ t: new Date().toISOString(), nivel, suceso, ...datos });
  if (nivel === "error") console.error(linea);
  else if (nivel === "aviso") console.warn(linea);
  else console.log(linea);
}

/** Un error en datos que se pueden registrar (mensaje y las primeras líneas de la pila). */
export function datosDeError(e: unknown) {
  if (e instanceof Error)
    return { error: e.name, mensaje: e.message, pila: e.stack?.split("\n").slice(0, 6).join("\n") };
  return { error: "desconocido", mensaje: String(e) };
}
