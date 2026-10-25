import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { listarLocales } from "@/lib/servidor/nube";
import { duenoActual, esAdmin } from "@/lib/servidor/sesion";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";

export const metadata: Metadata = { title: "Panel de Comanda", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Para quien vende Comanda: todos los bares, de quién son y si se usan. */
export default async function Admin() {
  if (!esAdmin(await duenoActual())) notFound();
  const bares = await listarLocales();
  const activos = bares.filter((b) => b.tickets30Dias > 0).length;
  return (
    <PaginaCuenta titulo="Panel de Comanda" ancho="max-w-5xl">
      <p className="mb-4 text-tinta-suave">
        {bares.length} bares · {activos} con ventas en los últimos 30 días
      </p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc">
        <table className="w-full text-sm">
          <thead className="bg-zinc-claro text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Bar</th>
              <th className="px-3 py-2 font-semibold">Dueño</th>
              <th className="px-3 py-2 font-semibold">Alta</th>
              <th className="px-3 py-2 font-semibold">Último movimiento</th>
              <th className="px-3 py-2 text-right font-semibold">Tickets (30 días)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc">
            {bares.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <b>{b.nombre}</b>
                  <span className="block text-xs text-tinta-suave">
                    {b.id}
                    {b.esDemo && " · demostración"}
                  </span>
                </td>
                <td className="px-3 py-2">{b.propietario ?? "—"}</td>
                <td className="px-3 py-2">{formatearFecha(b.creadoEn)}</td>
                <td className="px-3 py-2">
                  {b.ultimaActividad ? formatearFechaHora(b.ultimaActividad) : "Sin abrir"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{b.tickets30Dias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaginaCuenta>
  );
}
