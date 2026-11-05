import "server-only";
import { rpc } from "./supabase-rpc";

/** Limitador sencillo en memoria: como mucho `maximo` intentos por clave cada `ventanaMs`. */
export function crearLimite(maximo: number, ventanaMs: number) {
  const intentos = new Map<string, number[]>();
  return (clave: string, ahora = Date.now()): boolean => {
    const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= maximo) {
      intentos.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    intentos.set(clave, recientes);
    if (intentos.size > 5000) intentos.clear();
    return true;
  };
}

export function ipDe(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

/**
 * Como `crearLimite`, pero en la nube cuenta en la base de datos: así vale igual en todos los
 * servidores de la app (en memoria, cada uno llevaría su cuenta y se podría probar el triple).
 * Si la base de datos no responde, cuenta en memoria para no dejar a nadie fuera.
 */
export function crearLimiteCompartido(nombre: string, maximo: number, ventanaMs: number) {
  const enMemoria = crearLimite(maximo, ventanaMs);
  return async (clave: string): Promise<boolean> => {
    if (!process.env.TPV_CLAVE) return enMemoria(clave);
    try {
      return await rpc<boolean>("tpv_intento", {
        p_quien: `${nombre}|${clave}`,
        p_maximo: maximo,
        p_segundos: Math.round(ventanaMs / 1000),
      });
    } catch {
      return enMemoria(clave);
    }
  };
}

/**
 * Para los PIN: solo cuentan los fallos, y se mira si hay demasiados ANTES de comprobar el PIN
 * (si no, tras los fallos se podría seguir probando y el bueno entraría igual).
 */
export function crearLimiteDeFallos(nombre: string, maximo: number, ventanaMs: number) {
  const fallos = new Map<string, number[]>();
  const recientes = (clave: string, ahora = Date.now()) =>
    (fallos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  const enLaNube = () => Boolean(process.env.TPV_CLAVE);
  const quien = (clave: string) => `${nombre}|${clave}`;
  return {
    async bloqueado(clave: string): Promise<boolean> {
      if (enLaNube())
        try {
          const cuantos = await rpc<number>("tpv_intentos", {
            p_quien: quien(clave),
            p_segundos: Math.round(ventanaMs / 1000),
          });
          return cuantos >= maximo;
        } catch {
          // Sin la base de datos: lo que se sepa en este servidor.
        }
      return recientes(clave).length >= maximo;
    },
    async fallo(clave: string): Promise<void> {
      const lista = recientes(clave);
      lista.push(Date.now());
      if (fallos.size > 5000) fallos.clear();
      fallos.set(clave, lista);
      if (enLaNube())
        await rpc<boolean>("tpv_intento", {
          p_quien: quien(clave),
          p_maximo: maximo + 1000,
          p_segundos: Math.round(ventanaMs / 1000),
        }).catch(() => {});
    },
  };
}
