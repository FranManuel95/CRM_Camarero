"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Copy, Plus, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { useAhora } from "@/lib/cliente/use-ahora";
import {
  diasDeSemana,
  formatearMinutos,
  lunesDe,
  minutosTurno,
  turnosDe,
} from "@/lib/dominio/equipo";
import { sumarDias } from "@/lib/dominio/informes";
import type { TurnoCuadrante } from "@/lib/dominio/tipos";
import { diaLocal } from "@/lib/fechas";

type Borrador = Omit<TurnoCuadrante, "id"> & { id?: string };

const PUESTOS = ["Sala", "Barra", "Cocina", "Terraza"];

const cabecera = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const largo = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const fecha = (dia: string) => new Date(`${dia}T12:00:00Z`);

/** Cuadrante semanal: quién trabaja cada día y a qué hora. Se imprime para colgarlo. */
export function Cuadrante() {
  const { estado, hacer } = useDatos();
  const hoy = diaLocal(useAhora(60_000));
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const dias = diasDeSemana(lunes);
  const personas = estado.empleados.filter((e) => e.activo);
  const deLaSemana = estado.cuadrante.filter((t) => dias.includes(t.dia));
  const totalSemana = deLaSemana.reduce((s, t) => s + minutosTurno(t), 0);

  async function guardar() {
    if (!borrador) return;
    if (await hacer({ tipo: "guardar_turno", turno: borrador }, "Turno guardado"))
      setBorrador(null);
  }

  return (
    <section aria-labelledby="t-cuadrante">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="t-cuadrante" className="mr-auto font-rotulo text-2xl font-bold">
          Semana del {largo.format(fecha(dias[0]!))}
        </h2>
        <div className="no-imprimir flex flex-wrap gap-2">
          <Boton aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))}>
            <ChevronLeft aria-hidden className="size-4" />
          </Boton>
          <Boton disabled={lunes === lunesDe(hoy)} onClick={() => setLunes(lunesDe(hoy))}>
            Esta semana
          </Boton>
          <Boton aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))}>
            <ChevronRight aria-hidden className="size-4" />
          </Boton>
          <Boton
            disabled={!deLaSemana.length}
            onClick={() =>
              void hacer(
                { tipo: "copiar_semana", desde: lunes, hacia: sumarDias(lunes, 7) },
                "Turnos copiados a la semana siguiente",
              ).then((ok) => ok && setLunes(sumarDias(lunes, 7)))
            }
          >
            <Copy aria-hidden className="size-4" /> Copiar a la siguiente
          </Boton>
          <Boton onClick={() => window.print()}>
            <Printer aria-hidden className="size-4" /> Imprimir
          </Boton>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">
            Turnos de la semana: una fila por persona y una columna por día
          </caption>
          <thead>
            <tr className="border-b border-zinc">
              <th scope="col" className="w-32 p-2 text-left">
                Persona
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={clsx(
                    "p-2 text-left font-semibold capitalize",
                    d === hoy && "bg-cobalto-claro",
                  )}
                >
                  {cabecera.format(fecha(d))}
                </th>
              ))}
              <th scope="col" className="w-20 p-2 text-right">
                Horas
              </th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => {
              const horas = deLaSemana
                .filter((t) => t.empleadoId === p.id)
                .reduce((s, t) => s + minutosTurno(t), 0);
              return (
                <tr key={p.id} className="border-b border-zinc last:border-0">
                  <th scope="row" className="p-2 text-left align-top font-semibold">
                    {p.nombre}
                  </th>
                  {dias.map((d) => (
                    <td
                      key={d}
                      className={clsx("p-1.5 align-top", d === hoy && "bg-cobalto-claro/50")}
                    >
                      <div className="grid gap-1">
                        {turnosDe(estado.cuadrante, p.id, d).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setBorrador(t)}
                            className="rounded-md bg-cuenta-claro px-2 py-1 text-left hover:ring-2 hover:ring-cuenta"
                          >
                            <span className="sr-only">
                              Editar el turno de {p.nombre} el {largo.format(fecha(d))}:{" "}
                            </span>
                            <span className="block font-semibold tabular-nums">
                              {t.desde}–{t.hasta}
                            </span>
                            {t.puesto && (
                              <span className="block text-xs text-tinta-suave">{t.puesto}</span>
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label={`Añadir un turno a ${p.nombre} el ${largo.format(fecha(d))}`}
                          onClick={() =>
                            setBorrador({
                              empleadoId: p.id,
                              dia: d,
                              desde: "12:00",
                              hasta: "17:00",
                              puesto: "",
                            })
                          }
                          className="no-imprimir grid h-7 place-items-center rounded-md text-tinta-suave hover:bg-zinc"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="p-2 text-right align-top font-semibold tabular-nums">
                    {horas ? formatearMinutos(horas) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-tinta-suave">
        En total, {formatearMinutos(totalSemana)} de trabajo previstas esta semana.
      </p>

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? "Editar turno" : "Nuevo turno"}
        ancho="max-w-md"
      >
        {borrador && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Campo etiqueta="Persona">
              <select
                className={claseEntrada}
                value={borrador.empleadoId}
                onChange={(e) => setBorrador({ ...borrador, empleadoId: e.target.value })}
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Día">
              <select
                className={claseEntrada}
                value={borrador.dia}
                onChange={(e) => setBorrador({ ...borrador, dia: e.target.value })}
              >
                {(dias.includes(borrador.dia) ? dias : diasDeSemana(lunesDe(borrador.dia))).map(
                  (d) => (
                    <option key={d} value={d} className="capitalize">
                      {largo.format(fecha(d))}
                    </option>
                  ),
                )}
              </select>
            </Campo>
            <Campo etiqueta="Desde">
              <input
                type="time"
                required
                className={claseEntrada}
                value={borrador.desde}
                onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
              />
            </Campo>
            <Campo
              etiqueta="Hasta"
              ayuda={borrador.hasta < borrador.desde ? "Acaba al día siguiente." : undefined}
            >
              <input
                type="time"
                required
                className={claseEntrada}
                value={borrador.hasta}
                onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Puesto (opcional)" className="sm:col-span-2">
              <input
                className={claseEntrada}
                list="puestos"
                value={borrador.puesto}
                onChange={(e) => setBorrador({ ...borrador, puesto: e.target.value })}
                maxLength={30}
              />
              <datalist id="puestos">
                {PUESTOS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Campo>
            <p className="text-sm text-tinta-suave sm:col-span-2">
              {formatearMinutos(minutosTurno(borrador))} de turno.
            </p>
            <div className="flex gap-2 sm:col-span-2">
              {borrador.id && (
                <Boton
                  variante="peligro"
                  onClick={() =>
                    void hacer(
                      { tipo: "borrar_turno", turnoId: borrador.id! },
                      "Turno borrado",
                    ).then((ok) => ok && setBorrador(null))
                  }
                >
                  <Trash2 aria-hidden className="size-4" /> Borrar
                </Boton>
              )}
              <Boton
                type="submit"
                variante="primario"
                className="flex-1"
                disabled={borrador.desde === borrador.hasta}
              >
                Guardar turno
              </Boton>
            </div>
          </form>
        )}
      </Dialogo>
    </section>
  );
}
