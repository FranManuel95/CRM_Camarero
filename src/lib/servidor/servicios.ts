import type { Servicios } from "../dominio/funciones";

/** Qué servicios externos tiene configurados este servidor (sin enseñar las claves). */
export function servicios(): Servicios {
  return {
    ia: Boolean(process.env.ANTHROPIC_API_KEY),
    correo: Boolean(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE),
    aeat: Boolean(
      process.env.VERIFACTU_CERTIFICADO &&
      process.env.VERIFACTU_PRODUCTOR_NIF &&
      process.env.VERIFACTU_PRODUCTOR_NOMBRE,
    ),
  };
}
