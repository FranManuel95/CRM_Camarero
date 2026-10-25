import "server-only";

/** Llama a una función tpv_* de Supabase con la clave del servidor. */
export async function rpc<T>(funcion: string, argumentos: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apikey)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  const r = await fetch(`${url}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    headers: { apikey, Authorization: `Bearer ${apikey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_clave: process.env.TPV_CLAVE ?? "", ...argumentos }),
    cache: "no-store",
  });
  if (!r.ok) {
    console.error(`Supabase ${funcion}: ${r.status} ${await r.text()}`);
    throw new Error(`La base de datos no responde (${r.status}).`);
  }
  return (await r.json()) as T;
}
