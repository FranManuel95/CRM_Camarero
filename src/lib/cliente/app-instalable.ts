"use client";

/**
 * Registro del service worker y aviso de «se puede instalar». El navegador avisa una vez
 * (`beforeinstallprompt`); lo guardamos para ofrecer el botón cuando el encargado quiera.
 */
type AvisoInstalar = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

let aviso: AvisoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    avisar();
  });
}

export const suscribirInstalar = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
export const sePuedeInstalar = () => aviso !== null;
export const yaInstalada = () =>
  typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

export async function instalar(): Promise<boolean> {
  if (!aviso) return false;
  await aviso.prompt();
  const { outcome } = await aviso.userChoice;
  aviso = null;
  avisar();
  return outcome === "accepted";
}

/** Registra el service worker (o lo quita, si la función está apagada). */
export async function prepararApp(encendida: boolean) {
  if (!("serviceWorker" in navigator)) return;
  if (encendida) {
    await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  } else {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  }
}
