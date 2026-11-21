import type { Metadata } from "next";
import { Comanda, type AbrirEnMesa } from "./comanda";

export const metadata: Metadata = { title: "Mesa" };

const ABRIR = new Set<AbrirEnMesa>(["cuenta", "cobrar", "mover", "precios", "anular"]);

/**
 * La cuenta de una mesa. Los enlaces de la ayuda pueden dejarla abierta en el sitio exacto:
 * `?abrir=precios&lineas=a,b` (con esas líneas marcadas), `?abrir=cuenta&linea=x` (resaltada)…
 */
export default async function PaginaMesa({
  params,
  searchParams,
}: {
  params: Promise<{ mesaId: string }>;
  searchParams: Promise<{ abrir?: string; lineas?: string; linea?: string }>;
}) {
  const [{ mesaId }, q] = await Promise.all([params, searchParams]);
  const abrir = ABRIR.has(q.abrir as AbrirEnMesa) ? (q.abrir as AbrirEnMesa) : undefined;
  const lineas = (q.lineas ?? "").split(",").filter(Boolean).slice(0, 100);
  return <Comanda mesaId={mesaId} abrir={abrir} lineas={lineas} resaltar={q.linea} />;
}
