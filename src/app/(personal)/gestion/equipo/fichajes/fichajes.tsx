"use client";

import clsx from "clsx";
import { AlertTriangle, Download, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada, Vacio } from "@/components/ui";
import { useAhora } from "@/lib/cliente/use-ahora";
import {
  formatearMinutos,
  horaDe,
  minutosDePausa,
  minutosTrabajados,
  resumenJornada,
  sinSalida,
} from "@/lib/dominio/equipo";
import type { Fichaje } from "@/lib/dominio/tipos";
import { diaLocal } from "@/lib/fechas";
import { DialogoFichaje, type Correccion } from "./dialogo-fichaje";

const dia = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaDe = (iso: string) => dia.format(new Date(`${diaLocal(iso)}T12:00:00Z`));

/**
 * Registro de jornada: lo fichado frente a lo previsto, las correcciones y la descarga en CSV
 * para la gestoría o la Inspección.
 */
export function Fichajes({ nube }: { nube: boolean }) {
  const { estado } = useDatos();
  const ahora = useAhora(60_000);
  const hoy = diaLocal(ahora);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [persona, setPersona] = useState("todas");
  const [corrigiendo, setCorrigiendo] = useState<Correccion | null>(null);

  const desde = `${mes}-01`;
  const finDeMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const hasta = finDeMes < hoy ? finDeMes : hoy;
  const nombre = (id: string) => estado.empleados.find((e) => e.id === id)?.nombre ?? "—";
  const olvidos = sinSalida(estado.fichajes, ahora);
  const resumen = resumenJornada(estado, desde, hasta, ahora);
  const lista = estado.fichajes
    .filter(
      (f) =>
        diaLocal(f.entrada) >= desde &&
        diaLocal(f.entrada) <= finDeMes &&
        (persona === "todas" || f.empleadoId === persona),
    )
    .sort((a, b) => b.entrada.localeCompare(a.entrada));

  const corregir = (f: Fichaje) => setCorrigiendo({ fichaje: f });

  return (
    <section aria-labelledby="t-fichajes">
      <h2 id="t-fichajes" className="sr-only">
        Fichajes
      </h2>

      {olvidos.length > 0 && (
        <div className="mb-4 rounded-xl bg-aviso-claro p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden className="size-5 text-aviso" />
            {olvidos.length === 1
              ? "Hay una jornada sin salida"
              : `Hay ${olvidos.length} jornadas sin salida`}
          </p>
          <ul className="grid gap-1">
            {olvidos.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="mr-auto">
                  {nombre(f.empleadoId)} entró el {diaDe(f.entrada)} a las {horaDe(f.entrada)} y no
                  fichó la salida.
                </span>
                <Boton tamano="pequeno" onClick={() => corregir(f)}>
                  Poner la salida
                </Boton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-sm font-semibold">Mes</span>
          <input
            type="month"
            className={claseEntrada}
            value={mes}
            max={hoy.slice(0, 7)}
            onChange={(e) => e.target.value && setMes(e.target.value)}
          />
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton onClick={() => setCorrigiendo({ fichaje: null })}>
            <Plus aria-hidden className="size-4" /> Apuntar a mano
          </Boton>
          <a
            href={`/api/registro-jornada?desde=${desde}&hasta=${hasta}`}
            download
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-cobalto px-4 font-semibold text-white hover:bg-cobalto-oscuro"
          >
            <Download aria-hidden className="size-4" /> Descargar el registro
          </a>
        </div>
      </div>

      <div
        className="mb-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc"
        tabIndex={0}
        role="region"
        aria-label="Horas del mes por persona"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Horas de cada persona en el mes</caption>
          <thead>
            <tr className="border-b border-zinc text-left">
              <th scope="col" className="px-2 py-2.5 sm:p-3">
                Persona
              </th>
              <th scope="col" className="px-2 py-2.5 text-right sm:p-3">
                Días
              </th>
              <th scope="col" className="px-2 py-2.5 text-right sm:p-3">
                Fichadas
              </th>
              <th scope="col" className="px-2 py-2.5 text-right sm:p-3">
                Previstas
              </th>
              <th scope="col" className="px-2 py-2.5 text-right sm:p-3">
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => {
              const dif = r.trabajados - r.previstos;
              return (
                <tr key={r.empleado.id} className="border-b border-zinc last:border-0">
                  <th scope="row" className="px-2 py-2.5 text-left font-semibold sm:p-3">
                    {r.empleado.nombre}
                    {r.abiertos > 0 && (
                      <span className="block text-xs font-normal text-tinta-suave sm:ml-2 sm:inline">
                        ({r.abiertos} sin cerrar)
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums sm:p-3">
                    {r.dias}
                  </td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums sm:p-3">
                    {formatearMinutos(r.trabajados)}
                  </td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums sm:p-3">
                    {r.previstos ? formatearMinutos(r.previstos) : "—"}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums sm:p-3",
                      r.previstos && dif > 0 && "text-aviso",
                    )}
                  >
                    {r.previstos ? `${dif > 0 ? "+" : ""}${formatearMinutos(dif)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="-mt-4 mb-6 text-xs text-tinta-suave">
        Previstas: las horas del cuadrante hasta hoy. Solo cuentan las jornadas ya cerradas.
      </p>
      {lista.length === 0 ? (
        <Vacio titulo="Nadie ha fichado este mes">
          Cada persona ficha con su PIN en <b>Fichar</b> (arriba, o desde la pantalla del PIN).
        </Vacio>
      ) : (
        <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
          {lista.map((f) => {
            const pausa = minutosDePausa(f, f.salida ?? ahora);
            return (
              <li key={f.id} className="flex items-center gap-x-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {nombre(f.empleadoId)}{" "}
                    <span className="font-normal text-tinta-suave">· {diaDe(f.entrada)}</span>
                  </span>
                  <span className="block text-sm text-tinta-suave">
                    {horaDe(f.entrada)} – {f.salida ? horaDe(f.salida) : "sin salida"}
                    {pausa > 0 && ` · descanso ${formatearMinutos(pausa)}`}
                    {f.cambios?.length ? (
                      <span
                        className="mt-1 block w-fit rounded bg-ocupada-claro px-1.5 text-xs text-tinta"
                        title={f.cambios
                          .map((c) => `${nombre(c.por)} (${diaDe(c.en)}): ${c.motivo}`)
                          .join("\n")}
                      >
                        corregido: {f.cambios.at(-1)!.motivo}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-right font-semibold whitespace-nowrap tabular-nums">
                  {f.salida ? formatearMinutos(minutosTrabajados(f, ahora)) : "—"}
                </span>
                <Boton
                  tamano="pequeno"
                  variante="fantasma"
                  aria-label={`Corregir el fichaje de ${nombre(f.empleadoId)} del ${diaDe(f.entrada)}`}
                  onClick={() => corregir(f)}
                >
                  <Pencil aria-hidden className="size-4" />
                </Boton>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-sm text-tinta-suave">
        Los fichajes no se borran: cada corrección queda apuntada con quién la hizo, cuándo y por
        qué. El registro se guarda cuatro años
        {nube ? "; aquí se ven los dos últimos meses y el CSV lleva el periodo completo." : "."}
      </p>

      <DialogoFichaje correccion={corrigiendo} alCerrar={() => setCorrigiendo(null)} />
    </section>
  );
}
