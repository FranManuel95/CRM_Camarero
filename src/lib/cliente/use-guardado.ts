"use client";

import { useCallback, useSyncExternalStore } from "react";

type Tipo = "local" | "sesion";

const oyentes = new Set<() => void>();
const cache = new Map<string, { bruto: string | null; valor: unknown }>();

function almacen(tipo: Tipo): Storage | null {
  try {
    return tipo === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

/**
 * Un valor guardado en el navegador (localStorage o sessionStorage), como un useState. Si el
 * navegador no deja guardar (modo privado), funciona igual pero se olvida al recargar.
 */
export function useGuardado<T>(
  clave: string,
  inicial: T,
  tipo: Tipo = "local",
): [T, (v: T | ((previo: T) => T)) => void] {
  const leer = useCallback((): T => {
    const bruto = almacen(tipo)?.getItem(clave) ?? null;
    const previo = cache.get(clave);
    if (previo && previo.bruto === bruto) return previo.valor as T;
    let valor = inicial;
    try {
      if (bruto !== null) valor = JSON.parse(bruto) as T;
    } catch {}
    cache.set(clave, { bruto, valor });
    return valor;
    // `inicial` solo cuenta la primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, tipo]);

  const valor = useSyncExternalStore(suscribir, leer, () => inicial);

  const guardar = useCallback(
    (nuevo: T | ((previo: T) => T)) => {
      const siguiente = typeof nuevo === "function" ? (nuevo as (p: T) => T)(leer()) : nuevo;
      const bruto = JSON.stringify(siguiente);
      cache.set(clave, { bruto, valor: siguiente });
      try {
        almacen(tipo)?.setItem(clave, bruto);
      } catch {}
      for (const o of oyentes) o();
    },
    [clave, tipo, leer],
  );

  return [valor, guardar];
}

const nada = () => () => {};
/** Un dato del navegador que no cambia (como la dirección de la página); vacío en el servidor. */
export function useDelNavegador<T>(leer: () => T, enServidor: T): T {
  return useSyncExternalStore(nada, leer, () => enServidor);
}
