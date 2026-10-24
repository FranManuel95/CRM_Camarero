import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Empleado } from "../dominio/tipos";
import { leerEstado, secreto } from "./almacen";

export const COOKIE_SESION = "tpv_sesion";
const DOCE_HORAS = 12 * 60 * 60;

function firmar(valor: string) {
  return createHmac("sha256", secreto()).update(valor).digest("base64url");
}

/** Valor de la cookie: «idEmpleado.caduca.firma». */
export function crearValorSesion(empleadoId: string, ahora = Date.now()) {
  const caduca = Math.floor(ahora / 1000) + DOCE_HORAS;
  const datos = `${empleadoId}.${caduca}`;
  return `${datos}.${firmar(datos)}`;
}

export function leerValorSesion(valor: string | undefined, ahora = Date.now()): string | null {
  if (!valor) return null;
  const partes = valor.split(".");
  if (partes.length !== 3) return null;
  const [id, caduca, firma] = partes as [string, string, string];
  const esperada = Buffer.from(firmar(`${id}.${caduca}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  if (Number(caduca) * 1000 < ahora) return null;
  return id;
}

/**
 * La cookie va marcada como segura cuando la página llega por https. En la wifi del bar se entra
 * por http://IP-del-ordenador y ahí una cookie segura no se guardaría.
 */
export function opcionesCookie(request: Request) {
  const https =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: DOCE_HORAS, secure: https };
}

/** El empleado con sesión abierta, o null. */
export async function empleadoActual(): Promise<Empleado | null> {
  const id = leerValorSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!id) return null;
  return (await leerEstado()).empleados.find((e) => e.id === id && e.activo) ?? null;
}
