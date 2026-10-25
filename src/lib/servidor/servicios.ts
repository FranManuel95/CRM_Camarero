import type { Servicios } from "../dominio/funciones";

/** Qué servicios externos tiene configurados este servidor (sin enseñar las claves). */
export function servicios(): Servicios {
  return {
    ia: Boolean(process.env.ANTHROPIC_API_KEY),
    pagos: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    correo: Boolean(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE),
  };
}
