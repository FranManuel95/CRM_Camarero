import type { Metadata } from "next";
import Link from "next/link";
import { reglasClub } from "@/lib/dominio/club";
import { activa } from "@/lib/dominio/funciones";
import { euros } from "@/lib/dominio/importes";
import { leerEstado } from "@/lib/servidor/almacen";
import { CabeceraPublica, NoDisponible } from "../../publico";
import { RecordarTarjeta } from "./recordar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi tarjeta", robots: { index: false } };

type Params = {
  params: Promise<{ local: string; codigo: string }>;
  searchParams: Promise<{ mesa?: string }>;
};

/** La tarjeta del club del cliente: sus puntos y cuánto le falta para el premio. */
export default async function Tarjeta({ params, searchParams }: Params) {
  const { local, codigo } = await params;
  const { mesa } = await searchParams;
  const estado = await leerEstado(local).catch(() => null);
  if (!estado || !activa(estado.ajustes, "club")) return <NoDisponible que="ver la tarjeta" />;
  const cliente = estado.clientes.find((c) => c.codigo === codigo);
  if (!cliente) return <NoDisponible que="ver esta tarjeta" />;
  const reglas = reglasClub(estado);
  const progreso = Math.min(100, Math.round((cliente.puntos / reglas.puntosPremio) * 100));
  const faltan = Math.max(0, reglas.puntosPremio - cliente.puntos);
  return (
    <div className="min-h-dvh bg-white">
      <RecordarTarjeta local={local} codigo={codigo} />
      <CabeceraPublica nombre={estado.ajustes.nombreLocal} titulo="Tu tarjeta del club" />
      <main className="mx-auto max-w-md p-4">
        <p className="mb-1 text-lg">¡Hola, {cliente.nombre.split(" ")[0]}!</p>
        <p className="font-rotulo text-6xl font-bold text-cobalto">
          {cliente.puntos} <span className="text-3xl">puntos</span>
        </p>
        <div
          className="my-3 h-4 overflow-hidden rounded-full bg-zinc"
          role="progressbar"
          aria-label="Camino al premio"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-cuenta" style={{ width: `${progreso}%` }} />
        </div>
        <p className="mb-5">
          {faltan
            ? `Te faltan ${faltan} puntos para ${euros(reglas.valorPremio)} de descuento.`
            : `¡Ya tienes ${euros(reglas.valorPremio)} de descuento! Pídeselo al camarero al pagar.`}
        </p>
        <div className="mb-5 rounded-2xl bg-zinc-claro p-4 text-center">
          <p className="text-sm text-tinta-suave">En la caja, di tu teléfono o este código:</p>
          <p className="font-rotulo text-4xl font-bold tracking-widest">
            {codigo.slice(0, 6).toUpperCase()}
          </p>
        </div>
        {mesa && (
          <Link
            href={`/m/${local}/${mesa}`}
            className="block rounded-lg bg-cobalto p-3 text-center font-semibold text-white"
          >
            Volver a la carta
          </Link>
        )}
        <p className="mt-6 text-xs text-tinta-suave">
          Guarda este enlace para ver tus puntos. Si quieres que borremos tus datos, pídelo en el
          bar.
        </p>
      </main>
    </div>
  );
}
