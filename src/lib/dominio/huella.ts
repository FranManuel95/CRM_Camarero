import { createHash } from "node:crypto";

/**
 * Huella encadenada de cada ticket: un SHA-256 que incluye la huella del ticket anterior. Si
 * alguien borra o cambia un ticket, la cadena deja de cuadrar y se nota (ver `verificarCadena`).
 *
 * El texto que se resume sigue el formato del registro de alta de VERI*FACTU (Orden
 * HAC/1177/2024), para que el paso a enviar los registros a la AEAT sea solo añadir el envío.
 * Ojo: esto prepara el terreno, pero el programa aún NO es un sistema VERI*FACTU certificado.
 */
export function calcularHuella(datos: {
  nif: string;
  numero: string;
  /** Fecha de expedición, ISO. */
  fecha: string;
  cuotaTotal: number;
  importeTotal: number;
  huellaAnterior: string;
  /** Momento en que se genera el registro, ISO con zona. */
  generadoEn: string;
}): string {
  const [anio, mes, dia] = datos.fecha.slice(0, 10).split("-");
  const texto = [
    `IDEmisorFactura=${datos.nif.trim()}`,
    `NumSerieFactura=${datos.numero.trim()}`,
    `FechaExpedicionFactura=${dia}-${mes}-${anio}`,
    `TipoFactura=F2`,
    `CuotaTotal=${(datos.cuotaTotal / 100).toFixed(2)}`,
    `ImporteTotal=${(datos.importeTotal / 100).toFixed(2)}`,
    `Huella=${datos.huellaAnterior}`,
    `FechaHoraHusoGenRegistro=${datos.generadoEn}`,
  ].join("&");
  return createHash("sha256").update(texto, "utf8").digest("hex").toUpperCase();
}

/** Devuelve el número del primer ticket cuya cadena no cuadra, o null si todo está bien. */
export function verificarCadena(
  tickets: { numero: string; huella: string; huellaAnterior: string }[],
): string | null {
  for (let i = 1; i < tickets.length; i++) {
    const actual = tickets[i];
    const previo = tickets[i - 1];
    if (actual && previo && actual.huellaAnterior !== previo.huella) return actual.numero;
  }
  return null;
}
