import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Empleado } from "../dominio/tipos";
import { enLaNube, LOCAL_ARCHIVO, leerEstado, secreto } from "./almacen";

/**
 * Tres cookies firmadas (nadie puede fabricarlas sin el secreto del servidor):
 * - **aparato**: a qué bar está vinculado este móvil o tablet. Dura un año.
 * - **sesión**: qué empleado ha entrado con su PIN, y en qué bar. Dura un turno largo.
 * - **dueño**: la cuenta del dueño (correo), para dar de alta bares y vincular aparatos.
 */
export const COOKIE_SESION = "tpv_sesion";
export const COOKIE_APARATO = "tpv_aparato";
export const COOKIE_DUENO = "tpv_dueno";

export const DURACION = {
  sesion: 12 * 60 * 60,
  aparato: 365 * 24 * 60 * 60,
  dueno: 30 * 24 * 60 * 60,
} as const;

function firmar(valor: string) {
  return createHmac("sha256", secreto()).update(valor).digest("base64url");
}

/** «parte1~parte2~…~caduca~firma». Las partes no pueden llevar «~». */
export function crearFirmado(partes: string[], segundos: number, ahora = Date.now()) {
  const datos = [...partes, String(Math.floor(ahora / 1000) + segundos)].join("~");
  return `${datos}~${firmar(datos)}`;
}

export function leerFirmado(
  valor: string | undefined,
  cuantas: number,
  ahora = Date.now(),
): string[] | null {
  if (!valor) return null;
  const trozos = valor.split("~");
  if (trozos.length !== cuantas + 2) return null;
  const firma = trozos.pop()!;
  const esperada = Buffer.from(firmar(trozos.join("~")));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  if (Number(trozos.pop()) * 1000 < ahora) return null;
  return trozos;
}

/**
 * La cookie va marcada como segura cuando la página llega por https. En la wifi del bar se entra
 * por http://IP-del-ordenador y ahí una cookie segura no se guardaría.
 */
export function opcionesCookie(request: Request, segundos: number) {
  const https =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: segundos, secure: https };
}

/** El bar al que está vinculado este aparato (en el ordenador del bar, siempre el mismo). */
export async function localDelAparato(): Promise<string | null> {
  if (!enLaNube()) return LOCAL_ARCHIVO;
  return leerFirmado((await cookies()).get(COOKIE_APARATO)?.value, 1)?.[0] ?? null;
}

export type Sesion = { local: string; empleado: Empleado };

/** El empleado con sesión abierta y su bar, o null. */
export async function sesionActual(): Promise<Sesion | null> {
  const partes = leerFirmado((await cookies()).get(COOKIE_SESION)?.value, 2);
  if (!partes) return null;
  const [local, id] = partes as [string, string];
  try {
    const empleado = (await leerEstado(local)).empleados.find((e) => e.id === id && e.activo);
    return empleado ? { local, empleado } : null;
  } catch {
    return null;
  }
}

export type Dueno = { id: string; email: string };

export async function duenoActual(): Promise<Dueno | null> {
  const partes = leerFirmado((await cookies()).get(COOKIE_DUENO)?.value, 2);
  return partes ? { id: partes[0]!, email: partes[1]! } : null;
}

/** Quien vende Comanda: los correos de ADMIN_EMAILS (separados por comas). */
export function esAdmin(dueno: Dueno | null) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(dueno && admins.includes(dueno.email.toLowerCase()));
}
