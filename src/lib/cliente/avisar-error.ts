/** Errores ya mandados en esta página: el mismo fallo repetido se manda una vez. */
const mandados = new Set<string>();

/** Manda al servidor un error de la pantalla (sin datos personales: mensaje, pila y ruta). */
export function avisarError(error: unknown, digest?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const clave = `${e.message}|${digest ?? ""}`;
  if (mandados.has(clave) || mandados.size > 10) return;
  mandados.add(clave);
  const cuerpo = JSON.stringify({
    mensaje: e.message.slice(0, 500),
    pila: e.stack?.slice(0, 2000),
    ruta: window.location.pathname,
    ...(digest ? { digest } : {}),
  });
  try {
    if (!navigator.sendBeacon?.("/api/errores", new Blob([cuerpo], { type: "application/json" })))
      void fetch("/api/errores", { method: "POST", body: cuerpo, keepalive: true });
  } catch {
    // Si ni esto funciona, no hay nada más que hacer.
  }
}
