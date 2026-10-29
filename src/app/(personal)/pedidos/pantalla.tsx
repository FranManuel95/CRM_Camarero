"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useDatos } from "@/components/datos-personal";
import { pantallaPedidos } from "@/lib/dominio/selectores";

/**
 * Pantalla para la tele o una tablet de cara al público: los pedidos para llevar que se están
 * preparando y los que ya se pueden recoger. Ocupa toda la pantalla.
 */
export function PantallaPedidos() {
  const { estado } = useDatos();
  const { preparando, listos } = pantallaPedidos(estado);
  return (
    <main className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-tinta text-white">
      <h1 className="flex items-center justify-between px-6 py-4 font-rotulo text-3xl font-bold sm:text-4xl">
        {estado.ajustes.nombreLocal}
        <Link
          href="/sala"
          className="grid size-11 place-items-center rounded-full text-zinc hover:bg-white/10"
        >
          <X aria-hidden className="size-6" />
          <span className="sr-only">Salir de la pantalla de pedidos</span>
        </Link>
      </h1>
      <div className="grid min-h-0 grid-cols-2 gap-4 px-4 pb-4 sm:gap-6 sm:px-6 sm:pb-6">
        <Columna titulo="Preparando" nombres={preparando} vacio="Nada en marcha" />
        <Columna titulo="¡Listo! Pasa a recoger" nombres={listos} vacio="Aún nada" listo />
      </div>
    </main>
  );
}

function Columna({
  titulo,
  nombres,
  vacio,
  listo = false,
}: {
  titulo: string;
  nombres: { id: string; nombre: string }[];
  vacio: string;
  listo?: boolean;
}) {
  return (
    <section
      aria-label={titulo}
      className={
        listo
          ? "flex min-h-0 flex-col rounded-3xl bg-cuenta p-4 text-white sm:p-6"
          : "flex min-h-0 flex-col rounded-3xl bg-white/10 p-4 sm:p-6"
      }
    >
      <h2 className="mb-4 font-rotulo text-2xl font-bold sm:text-4xl">{titulo}</h2>
      {nombres.length === 0 ? (
        <p className={listo ? "text-lg sm:text-2xl" : "text-lg text-zinc sm:text-2xl"}>{vacio}</p>
      ) : (
        <ul aria-live="polite" className="grid content-start gap-2 overflow-hidden sm:gap-3">
          {nombres.map((n) => (
            <li key={n.id} className="truncate text-2xl font-bold sm:text-5xl">
              {n.nombre}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
