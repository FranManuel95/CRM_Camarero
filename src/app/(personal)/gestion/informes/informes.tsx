"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Barras } from "@/components/barras";
import { Boton, claseEntrada } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import { informe, rangoDeDias, sumarDias } from "@/lib/dominio/informes";
import { NOMBRE_CATEGORIA_GASTO } from "@/lib/dominio/tipos";
import { aCsv, importeCsv } from "@/lib/csv";
import { descargar } from "@/lib/cliente/descargar";
import { diaLocal, formatearFechaHora } from "@/lib/fechas";
import { DIAS_EN_PANTALLA } from "@/lib/constantes";

const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", bizum: "Bizum", otro: "Otro" } as const;

export function Informes() {
  const { estado } = useDatos();
  const hoy = diaLocal(new Date().toISOString());
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const rango = rangoDeDias(desde, hasta < desde ? desde : hasta);
  const r = informe(estado, rango);
  const tickets = estado.tickets.filter((t) => t.fecha >= rango.desde && t.fecha < rango.hasta);

  const atajos = [
    { texto: "Hoy", desde: hoy, hasta: hoy },
    { texto: "Ayer", desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) },
    { texto: "7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { texto: "Este mes", desde: `${hoy.slice(0, 8)}01`, hasta: hoy },
    { texto: "30 días", desde: sumarDias(hoy, -29), hasta: hoy },
  ];

  function exportarTickets() {
    descargar(
      `tickets_${desde}_${hasta}.csv`,
      aCsv([
        [
          "Número",
          "Fecha",
          "Mesa",
          "Camarero",
          "Base",
          "IVA",
          "Total",
          "Forma de pago",
          "Rectifica a",
          "Huella",
        ],
        ...tickets.map((t) => [
          t.numero,
          formatearFechaHora(t.fecha),
          t.mesaNombre,
          estado.empleados.find((e) => e.id === t.empleadoId)?.nombre ?? "",
          importeCsv(t.desglose.reduce((s, d) => s + d.base, 0)),
          importeCsv(t.desglose.reduce((s, d) => s + d.cuota, 0)),
          importeCsv(t.total),
          t.pagos.map((p) => METODOS[p.metodo]).join(" + "),
          estado.tickets.find((x) => x.id === t.rectificaA)?.numero ?? "",
          t.huella,
        ]),
      ]),
    );
  }

  function exportarGastos() {
    const gastos = estado.gastos.filter((g) => g.fecha >= rango.desde && g.fecha < rango.hasta);
    descargar(
      `gastos_${desde}_${hasta}.csv`,
      aCsv([
        [
          "Fecha",
          "Concepto",
          "Proveedor",
          "Categoría",
          "Total",
          "IVA %",
          "Base",
          "Cuota IVA",
          "Forma de pago",
        ],
        ...gastos.map((g) => {
          const base = Math.round(g.importe / (1 + g.iva / 100));
          return [
            formatearFechaHora(g.fecha),
            g.concepto,
            g.proveedor,
            NOMBRE_CATEGORIA_GASTO[g.categoria],
            importeCsv(g.importe),
            g.iva,
            importeCsv(base),
            importeCsv(g.importe - base),
            METODOS[g.metodo],
          ];
        }),
      ]),
    );
  }

  const maxProducto = Math.max(1, ...r.productos.map((p) => p.ventas));

  return (
    <main>
      <h1 className="mb-4 font-rotulo text-4xl font-bold">Informes</h1>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-zinc">
        <label>
          <span className="mb-1 block text-sm font-semibold">Desde</span>
          <input
            type="date"
            className={claseEntrada}
            value={desde}
            max={hoy}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Hasta</span>
          <input
            type="date"
            className={claseEntrada}
            value={hasta}
            max={hoy}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {atajos.map((a) => (
            <Boton
              key={a.texto}
              tamano="pequeno"
              variante={a.desde === desde && a.hasta === hasta ? "primario" : "secundario"}
              onClick={() => {
                setDesde(a.desde);
                setHasta(a.hasta);
              }}
            >
              {a.texto}
            </Boton>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Boton tamano="pequeno" onClick={exportarTickets}>
            <Download aria-hidden className="size-4" /> Tickets CSV
          </Boton>
          <Boton tamano="pequeno" onClick={exportarGastos}>
            <Download aria-hidden className="size-4" /> Gastos CSV
          </Boton>
        </div>
      </div>
      <p className="mb-4 text-xs text-tinta-suave">
        En pantalla se ven los últimos {DIAS_EN_PANTALLA} días. El histórico completo está en el
        archivo de datos del local.
      </p>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra
          titulo="Ventas (IVA incl.)"
          valor={euros(r.ventas)}
          nota={`${r.tickets} tickets · medio ${euros(r.ticketMedio)}`}
        />
        <Cifra titulo="Gastos (IVA incl.)" valor={euros(r.gastos)} />
        <Cifra
          titulo="Resultado sin IVA"
          valor={euros(r.resultado)}
          nota="Ventas − gastos, antes de impuestos"
        />
        <Cifra
          titulo="IVA a liquidar"
          valor={euros(r.ivaAPagar)}
          nota={`Repercutido ${euros(r.ivaRepercutido)} − soportado ${euros(r.ivaSoportado)}`}
        />
      </dl>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-dia">
          <h2 id="t-dia" className="mb-3 font-rotulo text-2xl font-bold">
            Ventas por día
          </h2>
          <Barras
            titulo="Ventas por día"
            datos={r.porDia.map((d) => ({
              etiqueta: d.fecha.slice(8) + "/" + d.fecha.slice(5, 7),
              valor: d.ventas,
              detalle: `${d.tickets} tickets`,
            }))}
          />
        </section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-hora">
          <h2 id="t-hora" className="mb-3 font-rotulo text-2xl font-bold">
            Ventas por hora
          </h2>
          <Barras
            titulo="Ventas por hora"
            datos={r.porHora.slice(8).map((v, i) => ({ etiqueta: `${i + 8}h`, valor: v }))}
          />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-prod">
          <h2 id="t-prod" className="mb-2 font-rotulo text-2xl font-bold">
            Productos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-tinta-suave">
                <tr>
                  <th className="py-1 font-semibold">Producto</th>
                  <th className="py-1 text-right font-semibold">Uds.</th>
                  <th className="py-1 text-right font-semibold">Ventas</th>
                  <th
                    className="py-1 text-right font-semibold"
                    title="Ventas sin IVA menos el coste de las raciones"
                  >
                    Margen
                  </th>
                  <th className="w-1/4 py-1">
                    <span className="sr-only">Proporción</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc">
                {r.productos.map((p) => (
                  <tr key={p.nombre}>
                    <td className="py-1.5">{p.nombre}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.unidades}</td>
                    <td className="py-1.5 text-right tabular-nums">{euros(p.ventas)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {p.coste === null ? "—" : euros(Math.round(p.ventas / 1.1) - p.coste)}
                    </td>
                    <td className="py-1.5 pl-3">
                      <div
                        className="h-2 rounded-r-[4px] bg-cobalto"
                        style={{ width: `${(p.ventas / maxProducto) * 100}%` }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-pago">
            <h2 id="t-pago" className="mb-2 font-rotulo text-2xl font-bold">
              Formas de pago
            </h2>
            <Lista
              filas={(Object.keys(METODOS) as (keyof typeof METODOS)[])
                .filter((m) => r.porMetodo[m])
                .map((m) => [METODOS[m], r.porMetodo[m]])}
            />
          </section>
          <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-cam">
            <h2 id="t-cam" className="mb-2 font-rotulo text-2xl font-bold">
              Por camarero
            </h2>
            <Lista
              filas={r.porEmpleado.map((e) => [`${e.nombre} · ${e.tickets} tickets`, e.ventas])}
            />
          </section>
          <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-gas">
            <h2 id="t-gas" className="mb-2 font-rotulo text-2xl font-bold">
              Gastos por tipo
            </h2>
            <Lista filas={r.porCategoriaGasto.map(([c, v]) => [NOMBRE_CATEGORIA_GASTO[c], v])} />
          </section>
        </div>
      </div>
      <p className="mt-4 text-xs text-tinta-suave">
        Cifras orientativas para llevar el negocio al día. La declaración de IVA y la contabilidad
        las cierra tu gestoría con estos CSV.
      </p>
    </main>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <dt className="text-sm text-tinta-suave">{titulo}</dt>
      <dd className="font-rotulo text-3xl font-bold">{valor}</dd>
      {nota && <dd className="text-xs text-tinta-suave">{nota}</dd>}
    </div>
  );
}

function Lista({ filas }: { filas: [string, number][] }) {
  if (!filas.length) return <p className="text-sm text-tinta-suave">Nada en estas fechas.</p>;
  return (
    <ul className="divide-y divide-zinc text-sm">
      {filas.map(([t, v]) => (
        <li key={t} className="flex justify-between py-1.5">
          <span>{t}</span>
          <span className="tabular-nums">{euros(v)}</span>
        </li>
      ))}
    </ul>
  );
}
