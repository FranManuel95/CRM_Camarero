import type { Contexto } from "@/lib/dominio/reducir";

/** Contexto con ids y hora predecibles para las pruebas. */
export function contexto(ahora = "2026-10-24T19:00:00.000Z"): Contexto {
  let n = 0;
  return { ahora, nuevoId: () => `id-${++n}`, nuevoToken: () => `token-${++n}` };
}
