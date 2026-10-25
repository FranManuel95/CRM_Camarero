import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Papel } from "@/components/papel";
import { leerEstado } from "@/lib/servidor/almacen";
import { sesionActual } from "@/lib/servidor/sesion";

export const metadata: Metadata = { title: "Imprimir" };
export const dynamic = "force-dynamic";

/** Página que se imprime desde el navegador (la carga un iframe escondido o se abre a mano). */
export default async function Imprimir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ columnas?: string }>;
}) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/entrar");
  const [{ id }, { columnas }] = await Promise.all([params, searchParams]);
  const trabajo = (await leerEstado(sesion.local)).trabajos.find((t) => t.id === id);
  if (!trabajo) return <p className="p-6">Este trabajo ya no está en la cola de impresión.</p>;
  return (
    <main className="bg-white">
      <Papel documento={trabajo.documento} columnas={Number(columnas) || 48} />
    </main>
  );
}
