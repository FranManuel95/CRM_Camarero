import type { Servicios } from "../dominio/funciones";

/** Qué servicios externos tiene configurados este servidor (sin enseñar las claves). */
export function servicios(): Servicios {
  return { ia: Boolean(process.env.ANTHROPIC_API_KEY) };
}
