"use client";

import clsx from "clsx";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { useAhora } from "@/lib/cliente/use-ahora";
import { formatearMinutos, repartoPropinas } from "@/lib/dominio/equipo";
import { euros } from "@/lib/dominio/importes";
import type { Rango } from "@/lib/dominio/informes";

/** Cuánto le toca a cada uno de las propinas del periodo, por horas fichadas o a partes iguales. */
export function RepartoPropinas({ rango }: { rango: Rango }) {
  const { estado } = useDatos();
  const ahora = useAhora(60_000);
  const [modo, setModo] = useState<"horas" | "iguales">("horas");
  const { total, filas } = repartoPropinas(estado, rango, ahora, modo);
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-prop">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="t-prop" className="mr-auto font-rotulo text-2xl font-bold">
          Reparto de propinas · {euros(total)}
        </h2>
        <div
          className="flex rounded-lg bg-zinc-claro p-1"
          role="radiogroup"
          aria-label="Cómo se reparte"
        >
          {(
            [
              ["horas", "Por horas"],
              ["iguales", "A partes iguales"],
            ] as const
          ).map(([m, texto]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={clsx(
                "h-9 rounded-md px-3 text-sm font-semibold",
                modo === m ? "bg-white shadow" : "text-tinta-suave",
              )}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>
      {!total ? (
        <p className="text-sm text-tinta-suave">No hay propinas en estas fechas.</p>
      ) : !filas.length ? (
        <p className="text-sm text-tinta-suave">
          Hay propinas, pero nadie fichó en estas fechas: con los fichajes se reparte solo.
        </p>
      ) : (
        <ul className="divide-y divide-zinc">
          {filas.map((f) => (
            <li key={f.empleadoId} className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{f.nombre}</span>
                <span className="ml-2 text-sm text-tinta-suave">{formatearMinutos(f.minutos)}</span>
              </span>
              <span className="font-rotulo text-2xl font-bold tabular-nums">
                {euros(f.importe)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
