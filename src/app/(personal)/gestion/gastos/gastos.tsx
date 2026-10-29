"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor, Vacio } from "@/components/ui";
import { euros, leerEuros } from "@/lib/dominio/importes";
import {
  type CategoriaGasto,
  type Gasto,
  type MetodoGasto,
  NOMBRE_CATEGORIA_GASTO,
} from "@/lib/dominio/tipos";
import { diaLocal, formatearFecha } from "@/lib/fechas";
import { inicioDelDia } from "@/lib/dominio/informes";

type Borrador = {
  id?: string;
  fecha: string;
  concepto: string;
  categoria: CategoriaGasto;
  proveedor: string;
  importe: string;
  iva: number;
  metodo: MetodoGasto;
  deCaja: boolean;
};

const vacio = (): Borrador => ({
  fecha: diaLocal(new Date().toISOString()),
  concepto: "",
  categoria: "proveedores",
  proveedor: "",
  importe: "",
  iva: 10,
  metodo: "tarjeta",
  deCaja: false,
});

export function Gastos() {
  const { estado, hacer } = useDatos();
  const [mes, setMes] = useState(diaLocal(new Date().toISOString()).slice(0, 7));
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [filtro, setFiltro] = useState<CategoriaGasto | "todas">("todas");

  const delMes = estado.gastos
    .filter(
      (g) => diaLocal(g.fecha).startsWith(mes) && (filtro === "todas" || g.categoria === filtro),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = delMes.reduce((s, g) => s + g.importe, 0);
  const proveedores = [...new Set(estado.gastos.map((g) => g.proveedor).filter(Boolean))].sort();

  function editar(g: Gasto) {
    setBorrador({
      ...g,
      fecha: diaLocal(g.fecha),
      importe: (g.importe / 100).toFixed(2).replace(".", ","),
    });
  }

  async function guardar() {
    if (!borrador) return;
    const importe = leerEuros(borrador.importe);
    if (!importe) return;
    const { importe: _i, fecha, ...resto } = borrador;
    void _i;
    // Se guarda a mediodía para que el día no cambie con el horario de verano.
    const instante = new Date(Date.parse(inicioDelDia(fecha)) + 12 * 3_600_000).toISOString();
    if (
      await hacer(
        { tipo: "guardar_gasto", gasto: { ...resto, fecha: instante, importe } },
        "Gasto guardado",
      )
    )
      setBorrador(null);
  }

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-rotulo text-4xl font-bold">Gastos</h1>
        <Boton variante="primario" onClick={() => setBorrador(vacio())}>
          <Plus aria-hidden className="size-4" /> Apuntar gasto
        </Boton>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-sm font-semibold">Mes</span>
          <input
            type="month"
            className={claseEntrada}
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Tipo</span>
          <select
            className={claseEntrada}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          >
            <option value="todas">Todos</option>
            {Object.entries(NOMBRE_CATEGORIA_GASTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-right">
          <span className="block text-sm text-tinta-suave">Total</span>
          <span className="font-rotulo text-3xl font-bold">{euros(total)}</span>
        </p>
      </div>

      {delMes.length === 0 ? (
        <Vacio titulo="Sin gastos este mes">
          Apunta las facturas de proveedores, la luz, el alquiler… y verás el resultado real.
        </Vacio>
      ) : (
        <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
          {delMes.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-20 shrink-0 text-sm text-tinta-suave">
                {formatearFecha(g.fecha)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.concepto}</span>
                <span className="block text-sm text-tinta-suave">
                  {NOMBRE_CATEGORIA_GASTO[g.categoria]}
                  {g.proveedor && ` · ${g.proveedor}`} · IVA {g.iva} %
                  {g.deCaja && " · pagado con la caja"}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{euros(g.importe)}</span>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Editar ${g.concepto}`}
                onClick={() => editar(g)}
              >
                <Pencil aria-hidden className="size-4" />
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Borrar ${g.concepto}`}
                onClick={() => {
                  if (confirm(`¿Borrar «${g.concepto}»?`))
                    void hacer({ tipo: "borrar_gasto", gastoId: g.id }, "Gasto borrado");
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? "Editar gasto" : "Apuntar gasto"}
      >
        {borrador && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Campo etiqueta="Concepto" className="sm:col-span-2">
              <input
                required
                className={claseEntrada}
                value={borrador.concepto}
                onChange={(e) => setBorrador({ ...borrador, concepto: e.target.value })}
                placeholder="Barriles de cerveza"
              />
            </Campo>
            <Campo etiqueta="Importe total (con IVA)">
              <input
                required
                inputMode="decimal"
                className={claseEntrada}
                value={borrador.importe}
                onChange={(e) => setBorrador({ ...borrador, importe: e.target.value })}
                placeholder="0,00"
              />
            </Campo>
            <Campo etiqueta="Fecha">
              <input
                type="date"
                required
                className={claseEntrada}
                value={borrador.fecha}
                onChange={(e) => setBorrador({ ...borrador, fecha: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Tipo">
              <select
                className={claseEntrada}
                value={borrador.categoria}
                onChange={(e) =>
                  setBorrador({ ...borrador, categoria: e.target.value as CategoriaGasto })
                }
              >
                {Object.entries(NOMBRE_CATEGORIA_GASTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Proveedor">
              <input
                className={claseEntrada}
                list="proveedores"
                value={borrador.proveedor}
                onChange={(e) => setBorrador({ ...borrador, proveedor: e.target.value })}
              />
              <datalist id="proveedores">
                {proveedores.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Campo>
            <Campo etiqueta="IVA de la factura">
              <select
                className={claseEntrada}
                value={borrador.iva}
                onChange={(e) => setBorrador({ ...borrador, iva: Number(e.target.value) })}
              >
                {[0, 4, 10, 21].map((i) => (
                  <option key={i} value={i}>
                    {i} %
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Forma de pago">
              <select
                className={claseEntrada}
                value={borrador.metodo}
                onChange={(e) =>
                  setBorrador({ ...borrador, metodo: e.target.value as MetodoGasto })
                }
              >
                <option value="tarjeta">Tarjeta o transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="bizum">Bizum</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
            {!borrador.id && (
              <div className="sm:col-span-2">
                <Interruptor
                  activo={borrador.deCaja}
                  alCambiar={(v) =>
                    setBorrador({
                      ...borrador,
                      deCaja: v,
                      metodo: v ? "efectivo" : borrador.metodo,
                    })
                  }
                  etiqueta="Pagado con dinero de la caja"
                  ayuda="Sale como retirada en el arqueo de hoy, así la caja cuadra."
                />
              </div>
            )}
            <Boton
              type="submit"
              variante="primario"
              className="sm:col-span-2"
              disabled={!leerEuros(borrador.importe) || !borrador.concepto.trim()}
            >
              Guardar gasto
            </Boton>
          </form>
        )}
      </Dialogo>
    </main>
  );
}
