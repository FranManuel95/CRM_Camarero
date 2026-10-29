import type { Metadata } from "next";
import { reglasClub } from "@/lib/dominio/club";
import { euros } from "@/lib/dominio/importes";
import { leerEstado } from "@/lib/servidor/almacen";
import { activa } from "@/lib/dominio/funciones";
import { CabeceraPublica, NoDisponible } from "../publico";
import { FormularioClub } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Club", robots: { index: false } };

type Params = {
  params: Promise<{ local: string }>;
  searchParams: Promise<{ mesa?: string }>;
};

/** Alta en el club del bar desde el móvil (también desde la carta QR de una mesa). */
export default async function PaginaClub({ params, searchParams }: Params) {
  const { local } = await params;
  const { mesa } = await searchParams;
  const estado = await leerEstado(local).catch(() => null);
  if (!estado || !activa(estado.ajustes, "club")) return <NoDisponible que="apuntarse al club" />;
  const reglas = reglasClub(estado);
  return (
    <div className="min-h-dvh bg-white">
      <CabeceraPublica nombre={estado.ajustes.nombreLocal} titulo="Club de clientes" />
      <main className="mx-auto max-w-md p-4">
        <ul className="mb-5 space-y-1 rounded-2xl bg-cobalto-claro p-4 text-cobalto-oscuro">
          <li>
            <strong>{reglas.puntosPorEuro}</strong>{" "}
            {reglas.puntosPorEuro === 1 ? "punto" : "puntos"} por cada euro.
          </li>
          <li>
            Con <strong>{reglas.puntosPremio} puntos</strong>, {euros(reglas.valorPremio)} de
            descuento.
          </li>
          {reglas.bienvenida > 0 && (
            <li>
              Y te regalamos <strong>{reglas.bienvenida} puntos</strong> por apuntarte.
            </li>
          )}
        </ul>
        <FormularioClub local={local} nombreLocal={estado.ajustes.nombreLocal} mesa={mesa} />
      </main>
    </div>
  );
}
