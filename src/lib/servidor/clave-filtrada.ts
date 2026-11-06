import "server-only";
import { createHash } from "node:crypto";

/**
 * ¿Aparece esta contraseña en filtraciones conocidas? Se pregunta a Pwned Passwords
 * (HaveIBeenPwned) sin mandar la contraseña: solo los 5 primeros caracteres de su huella SHA-1
 * («k-anonimato»); la lista que vuelve se compara aquí. Es lo mismo que hace Supabase en su plan
 * Pro. Si el servicio no responde, no se bloquea a nadie (devuelve false).
 */
export async function claveFiltrada(clave: string, espera = 3000): Promise<boolean> {
  const huella = createHash("sha1").update(clave, "utf8").digest("hex").toUpperCase();
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${huella.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Comanda-TPV" },
      signal: AbortSignal.timeout(espera),
      cache: "no-store",
    });
    if (!r.ok) return false;
    return apareceEnRango(await r.text(), huella);
  } catch {
    return false;
  }
}

/** Busca el resto de la huella en la respuesta («SUFIJO:veces» por línea; 0 veces es relleno). */
export function apareceEnRango(respuesta: string, huella: string): boolean {
  const sufijo = huella.slice(5).toUpperCase();
  return respuesta.split("\n").some((linea) => {
    const [resto, veces] = linea.trim().split(":");
    return resto?.toUpperCase() === sufijo && Number(veces) > 0;
  });
}

export const AVISO_CLAVE_FILTRADA =
  "Esa contraseña aparece en filtraciones de internet y es fácil de adivinar. Elige otra.";
