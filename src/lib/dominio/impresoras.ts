import type { EquipoPuente, Impresora } from "./tipos";

/**
 * Puertos válidos para imprimir: COM1…COM999 en Windows, o un aparato de /dev en Mac y Linux
 * (/dev/ttyUSB0, /dev/rfcomm0, /dev/cu.Printer, /dev/usb/lp0). Nada más: así no se puede usar
 * para escribir en un archivo cualquiera del ordenador.
 */
export const RUTA_PUERTO = /^(?:COM[1-9]\d{0,2}|\/dev\/(?!.*\.\.)[\w.\-/]{1,60})$/;

/** Velocidades habituales de las impresoras por puerto serie (las Bluetooth no la usan). */
export const BAUDIOS = [9600, 19200, 38400, 57600, 115200] as const;

/** Versión del puente que se reparte ahora (public/puente-impresion.mjs). */
export const VERSION_PUENTE = "2";

/** Pasados estos minutos sin noticias del puente, se da por parado. */
export const MINUTOS_PUENTE_PARADO = 8;

/** «Red · 192.168.1.120:9100», «Ordenador del puente · EPSON TM-T20», «Puerto COM5»… */
export function describirConexion(i: Impresora): string {
  switch (i.conexion) {
    case "red":
      return `Red · ${i.ip}:${i.puerto}`;
    case "sistema":
      return `En el ordenador del puente · ${i.nombreSistema ?? "sin nombre"}`;
    case "puerto":
      return `Puerto ${i.rutaPuerto ?? "?"} del ordenador del puente`;
    case "navegador":
      return "Conectada a una pantalla";
  }
}

/** ¿Ha dado señales el puente hace poco? */
export function puenteEnMarcha(puente: EquipoPuente | undefined, ahora: string): boolean {
  return Boolean(
    puente && Date.parse(ahora) - Date.parse(puente.visto) < MINUTOS_PUENTE_PARADO * 60_000,
  );
}
