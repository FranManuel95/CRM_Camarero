import type { Metadata } from "next";
import { barConFunciones, CabeceraPublica, NoDisponible } from "../publico";
import { FormularioEncargo } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Encargar para llevar" };

type Params = { params: Promise<{ local: string }> };

/** Página pública para encargar para llevar: nombre, teléfono y hora; luego la carta. */
export default async function PaginaEncargar({ params }: Params) {
  const { local } = await params;
  const bar = await barConFunciones(local, ["paraLlevar", "pedidosOnline"]);
  if (!bar) return <NoDisponible que="encargar desde aquí" />;
  return (
    <div className="min-h-dvh bg-white">
      <CabeceraPublica nombre={bar.nombre} titulo="Encargar para llevar" />
      <main className="mx-auto max-w-md p-4">
        <p className="mb-4 text-tinta-suave">
          Dinos quién eres y a qué hora pasas. Luego eliges de la carta y te lo tenemos listo.
        </p>
        <FormularioEncargo local={local} />
      </main>
    </div>
  );
}
