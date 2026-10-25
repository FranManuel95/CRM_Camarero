"use client";

import Link from "next/link";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Barras } from "@/components/barras";
import { euros } from "@/lib/dominio/importes";
import { informe, rangoDeDias, sumarDias } from "@/lib/dominio/informes";
import { primerosPasos } from "@/lib/dominio/primeros-pasos";
import { bajoMinimo } from "@/lib/dominio/stock";
import { situacion } from "@/lib/dominio/equipo";
import { NOMBRE_CATEGORIA_GASTO } from "@/lib/dominio/tipos";
import { diaLocal } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";

const nombreDia = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function Resumen() {
  const { estado } = useDatos();
  const ahora = useAhora(60_000);
  const hoy = diaLocal(ahora);
  const deHoy = informe(estado, rangoDeDias(hoy, hoy));
  const ayer = informe(estado, rangoDeDias(sumarDias(hoy, -1), sumarDias(hoy, -1)));
  const catorce = informe(estado, rangoDeDias(sumarDias(hoy, -13), hoy));
  const mes = informe(estado, rangoDeDias(`${hoy.slice(0, 8)}01`, hoy));
  const abiertas = estado.cuentas.filter((c) => c.estado === "abierta");
  const bajos = estado.ingredientes.filter(bajoMinimo);
  const conStock = useFuncion("stock");
  const conFichajes = useFuncion("fichajes");
  const trabajando = estado.empleados.filter(
    (e) => situacion(estado.fichajes, e.id, ahora).situacion !== "fuera",
  );
  const enMesas = abiertas.reduce(
    (s, c) =>
      s + c.lineas.filter((l) => l.estado !== "anulada" && l.estado !== "por_confirmar").length,
    0,
  );
  const agotados = estado.productos.filter((p) => !p.disponible);

  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
  const porDia = new Map(catorce.porDia.map((d) => [d.fecha, d]));

  return (
    <main>
      <h1 className="mb-4 font-rotulo text-4xl font-bold">Resumen</h1>
      <PrimerosPasos />
      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          titulo="Ventas de hoy"
          valor={euros(deHoy.ventas)}
          nota={`Ayer: ${euros(ayer.ventas)}`}
        />
        <Tarjeta
          titulo="Tickets hoy"
          valor={String(deHoy.tickets)}
          nota={`Medio: ${euros(deHoy.ticketMedio)}`}
        />
        <Tarjeta
          titulo="Mesas abiertas"
          valor={String(abiertas.length)}
          nota={`${enMesas} ${enMesas === 1 ? "línea" : "líneas"} sin cobrar`}
        />
        <Tarjeta
          titulo="Resultado del mes"
          valor={euros(mes.resultado)}
          nota={`Ventas ${euros(mes.ventasBase)} − gastos ${euros(mes.gastosBase)}, sin IVA`}
        />
      </dl>

      <section className="mb-6 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-14">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="t-14" className="font-rotulo text-2xl font-bold">
            Ventas de los últimos 14 días
          </h2>
          <Link
            href="/gestion/informes"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-cobalto underline"
          >
            Ver informes
          </Link>
        </div>
        <Barras
          titulo="Ventas por día"
          datos={dias.map((d) => ({
            etiqueta: nombreDia.format(new Date(`${d}T12:00:00Z`)),
            valor: porDia.get(d)?.ventas ?? 0,
            detalle: `${porDia.get(d)?.tickets ?? 0} tickets`,
          }))}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-top">
          <h2 id="t-top" className="mb-2 font-rotulo text-2xl font-bold">
            Lo que más se vende (14 días)
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-tinta-suave">
              <tr>
                <th className="py-1 font-semibold">Producto</th>
                <th className="py-1 text-right font-semibold">Uds.</th>
                <th className="py-1 text-right font-semibold">Ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc">
              {catorce.productos.slice(0, 8).map((p) => (
                <tr key={p.nombre}>
                  <td className="py-1.5">{p.nombre}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.unidades}</td>
                  <td className="py-1.5 text-right tabular-nums">{euros(p.ventas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-gastos">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="t-gastos" className="font-rotulo text-2xl font-bold">
              Gastos del mes
            </h2>
            <span className="font-semibold">{euros(mes.gastos)}</span>
          </div>
          <ul className="divide-y divide-zinc text-sm">
            {mes.porCategoriaGasto.map(([c, v]) => (
              <li key={c} className="flex justify-between py-1.5">
                <span>{NOMBRE_CATEGORIA_GASTO[c]}</span>
                <span className="tabular-nums">{euros(v)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/gestion/gastos"
            className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-cobalto underline"
          >
            Apuntar un gasto
          </Link>
          {agotados.length > 0 && (
            <p className="mt-4 rounded-lg bg-ocupada-claro p-3 text-sm">
              Agotado ahora: {agotados.map((p) => p.nombre).join(", ")}.{" "}
              <Link href="/gestion/carta" className="font-semibold underline">
                Cambiar en la carta
              </Link>
            </p>
          )}
          {conFichajes && (
            <p className="mt-4 rounded-lg bg-zinc-claro p-3 text-sm">
              {trabajando.length
                ? `Trabajando ahora: ${trabajando.map((e) => e.nombre).join(", ")}.`
                : "Ahora mismo no hay nadie fichado."}{" "}
              <Link href="/gestion/equipo/fichajes" className="font-semibold underline">
                Ver los fichajes
              </Link>
            </p>
          )}
          {conStock && bajos.length > 0 && (
            <p className="mt-4 rounded-lg bg-aviso-claro p-3 text-sm">
              En el mínimo: {bajos.map((i) => i.nombre).join(", ")}.{" "}
              <Link href="/gestion/stock" className="font-semibold underline">
                Ver la lista de la compra
              </Link>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <dt className="text-sm text-tinta-suave">{titulo}</dt>
      <dd className="font-rotulo text-3xl font-bold">{valor}</dd>
      {nota && <dd className="text-xs text-tinta-suave">{nota}</dd>}
    </div>
  );
}

/** Lo que le falta al bar para estar listo. Desaparece cuando está todo hecho. */
function PrimerosPasos() {
  const { estado } = useDatos();
  const pasos = primerosPasos(estado);
  const hechos = pasos.filter((p) => p.hecho).length;
  if (hechos === pasos.length) return null;
  return (
    <section aria-labelledby="t-pasos" className="mb-6 rounded-2xl bg-cobalto-claro p-4">
      <h2 id="t-pasos" className="mb-1 font-rotulo text-2xl font-bold">
        Primeros pasos
      </h2>
      <p className="mb-3 text-sm text-tinta-suave">
        {hechos} de {pasos.length} hechos. Cuando acabes, esta lista desaparece.
      </p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {pasos.map((p) => (
          <li key={p.clave}>
            <Link
              href={p.enlace}
              className={`flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc hover:ring-cobalto ${p.hecho ? "text-tinta-suave line-through" : "font-semibold"}`}
            >
              <span
                aria-hidden
                className={`grid size-5 shrink-0 place-items-center rounded-full text-xs text-white ${p.hecho ? "bg-cuenta" : "bg-zinc-oscuro"}`}
              >
                {p.hecho ? "✓" : ""}
              </span>
              {p.texto}
              <span className="sr-only">{p.hecho ? " (hecho)" : " (pendiente)"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
