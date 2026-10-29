"use client";

import { useDatos } from "@/components/datos-personal";
import type { Rango } from "@/lib/dominio/informes";
import { informeTiempos } from "@/lib/dominio/tiempos";
import { diaLocal } from "@/lib/fechas";

const minutos = (n: number) => `${Math.round(n)} min`;

/** Lo que tarda cada plato desde que se manda hasta que cocina o barra lo marca listo. */
export function TiemposCocina({ rango }: { rango: Rango }) {
  const { estado } = useDatos();
  const hasta = diaLocal(new Date(Date.parse(rango.hasta) - 1).toISOString());
  const { media, veces, filas } = informeTiempos(
    estado.tiemposCocina,
    diaLocal(rango.desde),
    hasta,
  );
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-tiempos">
      <h2 id="t-tiempos" className="mb-2 font-rotulo text-2xl font-bold">
        Tiempos de cocina
      </h2>
      {veces === 0 ? (
        <p className="text-sm text-tinta-suave">
          Aún no hay platos marcados como listos en estas fechas.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm">
            De media, un plato tarda <strong>{minutos(media)}</strong> ({veces} platos).
          </p>
          <div
            className="max-h-96 overflow-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabla de tiempos de cocina"
          >
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="sr-only">
                Tiempo medio y máximo de cada plato, los más lentos primero
              </caption>
              <thead>
                <tr className="border-b border-zinc text-right text-tinta-suave">
                  <th scope="col" className="py-2 text-left font-semibold">
                    Plato
                  </th>
                  <th scope="col" className="py-2 text-left font-semibold">
                    Dónde
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Veces
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Media
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Lo más lento
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={`${f.destino}-${f.producto}`}
                    className="border-b border-zinc text-right tabular-nums last:border-0"
                  >
                    <th scope="row" className="py-2 text-left font-semibold">
                      {f.producto}
                    </th>
                    <td className="py-2 text-left">
                      {f.destino === "cocina" ? "Cocina" : "Barra"}
                    </td>
                    <td className="py-2">{f.veces}</td>
                    <td className="py-2">{minutos(f.media)}</td>
                    <td className="py-2">{minutos(f.maximo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-tinta-suave">
        Cuenta desde que se manda la comanda hasta que se marca «listo» en la pantalla de cocina o
        barra.
      </p>
    </section>
  );
}
