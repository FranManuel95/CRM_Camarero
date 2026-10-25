// Service worker de Comanda: guarda los archivos de la app para que arranque aunque la red vaya
// mal. Los datos (/api) nunca se guardan aquí: siempre se piden al servidor.
const VERSION = "comanda-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nombre of await caches.keys()) if (nombre !== VERSION) await caches.delete(nombre);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Archivos que nunca cambian (llevan su versión en el nombre): primero lo guardado.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/iconos/")) {
    evento.respondWith(
      (async () => {
        const guardado = await caches.match(peticion);
        if (guardado) return guardado;
        const respuesta = await fetch(peticion);
        if (respuesta.ok) (await caches.open(VERSION)).put(peticion, respuesta.clone());
        return respuesta;
      })(),
    );
    return;
  }

  // Pantallas: primero la red; sin red, la última versión que se vio.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          const respuesta = await fetch(peticion);
          if (respuesta.ok) (await caches.open(VERSION)).put(peticion, respuesta.clone());
          return respuesta;
        } catch {
          const guardado = await caches.match(peticion);
          if (guardado) return guardado;
          return new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
              "<title>Sin conexión</title><body style='font-family:sans-serif;padding:2rem'>" +
              "<h1>Sin conexión</h1><p>Esta pantalla no se ha abierto antes en este aparato. " +
              "Vuelve a intentarlo cuando haya wifi.</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
  }
});
