/** El local está en España: todas las horas se enseñan en hora peninsular. */
export const ZONA_HORARIA = "Europe/Madrid";

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const soloHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
});
const soloFecha = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const claveDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const horaNum = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  hourCycle: "h23",
});

/** «24/10/2026, 21:05». */
export const formatearFechaHora = (iso: string) => fechaHora.format(new Date(iso));
/** «21:05». */
export const formatearHora = (iso: string) => soloHora.format(new Date(iso));
/** «24/10/2026». */
export const formatearFecha = (iso: string) => soloFecha.format(new Date(iso));
/** «2026-10-24», el día en hora de Madrid (para agrupar ventas por día). */
export const diaLocal = (iso: string) => claveDia.format(new Date(iso));
/** 0-23, la hora en Madrid (para las ventas por franja). */
export const horaLocal = (iso: string) => Number(horaNum.format(new Date(iso)));

/** Minutos enteros entre dos fechas. */
export function minutosEntre(desde: string, hasta: string): number {
  return Math.max(0, Math.floor((Date.parse(hasta) - Date.parse(desde)) / 60_000));
}

/** «lunes, 19 de octubre» → «Lunes, 19 de octubre» (solo la primera letra, no cada palabra). */
export const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
