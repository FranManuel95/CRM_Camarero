import "server-only";

/** Limitador sencillo en memoria: como mucho `maximo` intentos por clave cada `ventanaMs`. */
export function crearLimite(maximo: number, ventanaMs: number) {
  const intentos = new Map<string, number[]>();
  return (clave: string, ahora = Date.now()): boolean => {
    const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= maximo) {
      intentos.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    intentos.set(clave, recientes);
    if (intentos.size > 5000) intentos.clear();
    return true;
  };
}

export function ipDe(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}
