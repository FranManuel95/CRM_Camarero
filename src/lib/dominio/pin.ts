import { createHash } from "node:crypto";

/**
 * Los PIN no se guardan tal cual, sino su resumen SHA-256: quien vea la base de datos no ve los
 * PIN del equipo. (Un PIN de 4 cifras se adivina probando; lo que lo protege de verdad es el
 * límite de intentos al entrar.)
 */
export function resumenPin(pin: string): string {
  return createHash("sha256").update(`comanda-pin:${pin}`).digest("hex");
}
