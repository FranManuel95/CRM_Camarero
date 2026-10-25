"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { claseEntrada, Vacio } from "@/components/ui";
import { DIAS_EN_PANTALLA } from "@/lib/constantes";
import { conMayuscula, diaLocal, formatearHora } from "@/lib/fechas";

const dia = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** Quién hizo qué y cuándo: anulaciones, descuentos, caja, carta, equipo… */
export function Historial() {
  const { estado } = useDatos();
  const [persona, setPersona] = useState("todas");
  const [busca, setBusca] = useState("");
  const termino = busca.trim().toLowerCase();
  const nombre = (id: string) => estado.empleados.find((e) => e.id === id)?.nombre ?? "—";

  const entradas = [...estado.historial]
    .reverse()
    .filter(
      (h) =>
        (persona === "todas" || h.empleadoId === persona) &&
        (!termino || h.texto.toLowerCase().includes(termino)),
    );
  const porDia = new Map<string, typeof entradas>();
  for (const h of entradas) {
    const d = diaLocal(h.fecha);
    porDia.set(d, [...(porDia.get(d) ?? []), h]);
  }

  return (
    <main>
      <h1 className="mb-1 font-rotulo text-4xl font-bold">Historial</h1>
      <p className="mb-4 max-w-2xl text-tinta-suave">
        Lo importante que ha pasado en el bar y quién lo hizo. No se puede borrar. Aquí se ven los
        últimos {DIAS_EN_PANTALLA} días.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-56">
          <span className="mb-1 block text-sm font-semibold">Buscar</span>
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave"
            />
            <input
              type="search"
              className={`${claseEntrada} pl-9`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="anuló, descuento, precio…"
            />
          </span>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Persona</span>
          <select
            className={claseEntrada}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          >
            <option value="todas">Todo el equipo</option>
            {estado.empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {entradas.length === 0 ? (
        <Vacio titulo={termino || persona !== "todas" ? "Nada con ese filtro" : "Nada todavía"}>
          Aquí saldrán las anulaciones, invitaciones, descuentos, movimientos de caja, cambios de la
          carta y del equipo.
        </Vacio>
      ) : (
        <div className="grid gap-4">
          {[...porDia].map(([d, lista]) => (
            <section key={d} aria-label={dia.format(new Date(`${d}T12:00:00Z`))}>
              <h2 className="mb-1 text-sm font-semibold text-tinta-suave">
                {conMayuscula(dia.format(new Date(`${d}T12:00:00Z`)))}
              </h2>
              <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
                {lista.map((h) => (
                  <li key={h.id} className="flex gap-3 px-3 py-2.5">
                    <span className="w-12 shrink-0 text-sm text-tinta-suave tabular-nums">
                      {formatearHora(h.fecha)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{nombre(h.empleadoId)}</span> {h.texto}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
