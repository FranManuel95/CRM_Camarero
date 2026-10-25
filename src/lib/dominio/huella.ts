import { sha256 } from "../sha256";

/**
 * Huella encadenada de cada ticket: un SHA-256 que incluye la huella del ticket anterior. Si
 * alguien borra o cambia un ticket, la cadena deja de cuadrar y se nota (ver `verificarCadena`).
 *
 * Es la huella del registro de alta de VERI*FACTU (Orden HAC/1177/2024, art. 13, y el documento
 * técnico de la AEAT): «campo=valor» unidos por «&», en UTF-8, SHA-256 en hexadecimal mayúsculas.
 * Los tickets de antes de 2026-10-26 usaban la fecha en UTC y la hora con «Z»; la cadena entre
 * ellos sigue valiendo, porque cada uno guarda la huella del anterior.
 */
export function calcularHuella(datos: {
  nif: string;
  numero: string;
  /** Fecha de expedición, «24-10-2026» (día de Madrid). */
  fechaExpedicion: string;
  tipoFactura: "F1" | "F2" | "R5";
  cuotaTotal: number;
  importeTotal: number;
  huellaAnterior: string;
  /** Momento en que se genera el registro, «2026-10-24T21:05:09+02:00». */
  generadoEn: string;
}): string {
  const texto = [
    `IDEmisorFactura=${datos.nif.trim()}`,
    `NumSerieFactura=${datos.numero.trim()}`,
    `FechaExpedicionFactura=${datos.fechaExpedicion}`,
    `TipoFactura=${datos.tipoFactura}`,
    `CuotaTotal=${importeAeat(datos.cuotaTotal)}`,
    `ImporteTotal=${importeAeat(datos.importeTotal)}`,
    `Huella=${datos.huellaAnterior}`,
    `FechaHoraHusoGenRegistro=${datos.generadoEn}`,
  ].join("&");
  return sha256(texto).toUpperCase();
}

/** Céntimos como los escribe la AEAT: «12.35», «-4.00». */
export function importeAeat(centimos: number): string {
  return (centimos / 100).toFixed(2);
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
