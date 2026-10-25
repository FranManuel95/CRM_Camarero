"use client";

import { useDatos } from "@/components/datos-personal";
import { useAhora } from "@/lib/cliente/use-ahora";
import { formatearMinutos, informePorCamarero } from "@/lib/dominio/equipo";
import { euros } from "@/lib/dominio/importes";
import type { Rango } from "@/lib/dominio/informes";

/** Ventas, propinas, anulaciones, invitaciones y horas de cada persona en el periodo. */
export function PorCamarero({ rango }: { rango: Rango }) {
  const { estado } = useDatos();
  const ahora = useAhora(60_000);
  const filas = informePorCamarero(estado, rango, ahora);
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-cam">
      <h2 id="t-cam" className="mb-2 font-rotulo text-2xl font-bold">
        Por camarero
      </h2>
      {filas.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nada en estas fechas.</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla por camarero">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">
              Ventas, propinas, anulaciones, invitaciones y horas de cada persona
            </caption>
            <thead>
              <tr className="border-b border-zinc text-right text-tinta-suave">
                <th scope="col" className="py-2 text-left font-semibold">
                  Persona
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Ventas
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Tickets
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Ticket medio
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Propinas
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Anulado
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Invitado
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Horas
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Ventas por hora
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr
                  key={f.empleado.id}
                  className="border-b border-zinc text-right tabular-nums last:border-0"
                >
                  <th scope="row" className="py-2 text-left font-semibold">
                    {f.empleado.nombre}
                  </th>
                  <td className="py-2">{euros(f.ventas)}</td>
                  <td className="py-2">{f.tickets}</td>
                  <td className="py-2">
                    {f.tickets ? euros(Math.round(f.ventas / f.tickets)) : "—"}
                  </td>
                  <td className="py-2">{f.propinas ? euros(f.propinas) : "—"}</td>
                  <td className="py-2">
                    {f.anulaciones ? `${f.anulaciones} · ${euros(f.importeAnulado)}` : "—"}
                  </td>
                  <td className="py-2">
                    {f.invitaciones ? `${f.invitaciones} · ${euros(f.importeInvitado)}` : "—"}
                  </td>
                  <td className="py-2">{f.minutos ? formatearMinutos(f.minutos) : "—"}</td>
                  <td className="py-2">
                    {f.minutos >= 60 ? euros(Math.round((f.ventas / f.minutos) * 60)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-tinta-suave">
        Las ventas cuentan para quien abrió la mesa; las anulaciones e invitaciones, para quien
        anotó el plato. Las horas son las de las jornadas fichadas y cerradas.
      </p>
    </section>
  );
}
