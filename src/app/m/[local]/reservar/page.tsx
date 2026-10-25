import type { Metadata } from "next";
import { barConFunciones, CabeceraPublica, NoDisponible } from "../publico";
import { FormularioReserva } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservar mesa" };

type Params = { params: Promise<{ local: string }> };

/** Página pública para pedir mesa. El bar la confirma por teléfono. */
export default async function PaginaReservar({ params }: Params) {
  const { local } = await params;
  const bar = await barConFunciones(local, ["reservas", "reservasOnline"]);
  if (!bar) return <NoDisponible que="reservar desde aquí" />;
  return (
    <div className="min-h-dvh bg-white">
      <CabeceraPublica nombre={bar.nombre} titulo="Reservar mesa" />
      <main className="mx-auto max-w-md p-4">
        <p className="mb-4 text-tinta-suave">
          Pídenos mesa y te llamamos para confirmarla.
          {bar.telefono && ` Si corre prisa, llama al ${bar.telefono}.`}
        </p>
        <FormularioReserva local={local} />
      </main>
    </div>
  );
}
