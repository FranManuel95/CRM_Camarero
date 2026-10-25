"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Vacio } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import {
  bajoMinimo,
  formatearCantidad,
  listaDeLaCompra,
  platosCon,
  type PedidoProveedor,
  textoPedido,
} from "@/lib/dominio/stock";
import type { Ingrediente, TipoMovimientoStock } from "@/lib/dominio/tipos";
import { formatearFechaHora } from "@/lib/fechas";
import { DialogoAjuste, type Ajuste } from "./dialogo-ajuste";
import { DialogoIngrediente } from "./dialogo-ingrediente";
import { RecibirPedido, type PedidoInicial } from "./recibir-pedido";

type Pestana = "existencias" | "compra" | "movimientos";

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "existencias", texto: "Existencias" },
  { id: "compra", texto: "Lista de la compra" },
  { id: "movimientos", texto: "Movimientos" },
];

const NOMBRE_MOVIMIENTO: Record<TipoMovimientoStock, string> = {
  compra: "Compra",
  recuento: "Recuento",
  merma: "Merma",
};

export function Stock({ leerFacturas }: { leerFacturas: boolean }) {
  const { estado, hacer, avisar } = useDatos();
  const [pestana, setPestana] = useState<Pestana>("existencias");
  const [editando, setEditando] = useState<Ingrediente | "nuevo" | null>(null);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [pedido, setPedido] = useState<PedidoInicial | null>(null);

  const ingredientes = [...estado.ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const bajos = ingredientes.filter(bajoMinimo);
  const lista = listaDeLaCompra(estado.ingredientes);
  const valorAlmacen = ingredientes.reduce(
    (s, i) => s + Math.max(0, Math.round(i.existencias * i.coste)),
    0,
  );

  async function copiar(p: PedidoProveedor) {
    try {
      await navigator.clipboard.writeText(textoPedido(p, estado.ajustes.nombreLocal));
      avisar("Pedido copiado");
    } catch {
      avisar("No se ha podido copiar. Mándalo por WhatsApp.", "error");
    }
  }

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-rotulo text-4xl font-bold">Stock</h1>
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus aria-hidden className="size-4" /> Nuevo ingrediente
        </Boton>
        <Boton
          variante="primario"
          disabled={!ingredientes.length}
          onClick={() => setPedido({ proveedor: "", lineas: [] })}
        >
          <Truck aria-hidden className="size-4" /> Recibir pedido
        </Boton>
      </div>

      {bajos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-aviso-claro px-4 py-3">
          <AlertTriangle aria-hidden className="size-5 shrink-0 text-aviso" />
          <p className="mr-auto">
            <span className="font-semibold">
              {bajos.length === 1
                ? "1 ingrediente está en el mínimo"
                : `${bajos.length} ingredientes están en el mínimo`}
            </span>
            : {bajos.map((i) => i.nombre).join(", ")}.
          </p>
          <Boton tamano="pequeno" onClick={() => setPestana("compra")}>
            Ver la lista de la compra
          </Boton>
        </div>
      )}

      <div role="tablist" aria-label="Stock" className="mb-4 flex gap-1 overflow-x-auto">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            id={`pestana-${p.id}`}
            role="tab"
            type="button"
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => setPestana(p.id)}
            className={clsx(
              "h-10 shrink-0 rounded-lg px-4 font-semibold",
              pestana === p.id ? "bg-cobalto text-white" : "bg-white ring-1 ring-zinc-oscuro",
            )}
          >
            {p.texto}
            {p.id === "compra" && lista.length > 0 && ` (${lista.length})`}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`}>
        {pestana === "existencias" &&
          (ingredientes.length === 0 ? (
            <Vacio titulo="Todavía no hay ingredientes">
              Da de alta lo que compras (patatas, cerveza de barril, huevos…) y ponle a cada plato
              su escandallo en la carta. Al vender, se descuenta solo.
            </Vacio>
          ) : (
            <>
              <p className="mb-2 text-sm text-tinta-suave">
                Valor del almacén (a precio de la última compra):{" "}
                <span className="font-semibold text-tinta">{euros(valorAlmacen)}</span>
              </p>
              <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
                {ingredientes.map((i) => {
                  const platos = platosCon(estado, i.id).length;
                  const bajo = bajoMinimo(i);
                  return (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block font-semibold">{i.nombre}</span>
                        <span className="block text-sm text-tinta-suave">
                          {euros(i.coste)}/{i.unidad}
                          {i.proveedor && ` · ${i.proveedor}`}
                          {` · ${platos === 1 ? "en 1 plato" : `en ${platos} platos`}`}
                        </span>
                      </span>
                      <span className="text-right">
                        <span
                          className={clsx(
                            "block font-rotulo text-2xl font-bold tabular-nums",
                            bajo && "text-aviso",
                          )}
                        >
                          {formatearCantidad(i.existencias, i.unidad)}
                        </span>
                        <span className="block text-xs text-tinta-suave">
                          {i.existencias <= 0
                            ? "Se ha acabado"
                            : bajo
                              ? `En el mínimo (${formatearCantidad(i.minimo, i.unidad)})`
                              : `Mínimo ${formatearCantidad(i.minimo, i.unidad)}`}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        <Boton
                          tamano="pequeno"
                          onClick={() => setAjuste({ ingrediente: i, tipo: "recuento" })}
                          aria-label={`Contar ${i.nombre}`}
                        >
                          Contar
                        </Boton>
                        <Boton
                          tamano="pequeno"
                          onClick={() => setAjuste({ ingrediente: i, tipo: "merma" })}
                          aria-label={`Apuntar merma de ${i.nombre}`}
                        >
                          Merma
                        </Boton>
                        <Boton
                          tamano="pequeno"
                          variante="fantasma"
                          aria-label={`Editar ${i.nombre}`}
                          onClick={() => setEditando(i)}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Boton>
                        <Boton
                          tamano="pequeno"
                          variante="fantasma"
                          aria-label={`Borrar ${i.nombre}`}
                          onClick={() => {
                            const aviso = platos
                              ? ` Se quitará del escandallo de ${platos === 1 ? "1 plato" : `${platos} platos`}.`
                              : "";
                            if (confirm(`¿Borrar «${i.nombre}»?${aviso}`))
                              void hacer(
                                { tipo: "borrar_ingrediente", ingredienteId: i.id },
                                "Ingrediente borrado",
                              );
                          }}
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Boton>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ))}

        {pestana === "compra" &&
          (lista.length === 0 ? (
            <Vacio titulo="No hace falta pedir nada">
              Cuando algo llegue a su mínimo, saldrá aquí con lo que hay que pedir a cada proveedor.
            </Vacio>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {lista.map((p) => (
                <section
                  key={p.proveedor}
                  aria-label={`Pedido a ${p.proveedor}`}
                  className="rounded-2xl bg-white p-4 ring-1 ring-zinc"
                >
                  <h2 className="mb-2 flex items-baseline gap-2 font-rotulo text-2xl font-bold">
                    <ClipboardList aria-hidden className="size-5 self-center text-cobalto" />
                    <span className="mr-auto">{p.proveedor}</span>
                    <span className="text-base font-normal text-tinta-suave">
                      unos {euros(p.total)}
                    </span>
                  </h2>
                  <ul className="mb-3 divide-y divide-zinc">
                    {p.lineas.map((l) => (
                      <li key={l.ingrediente.id} className="flex justify-between gap-2 py-1.5">
                        <span>{l.ingrediente.nombre}</span>
                        <span className="font-semibold tabular-nums">
                          {formatearCantidad(l.cantidad, l.ingrediente.unidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Boton tamano="pequeno" onClick={() => void copiar(p)}>
                      <Copy aria-hidden className="size-4" /> Copiar
                    </Boton>
                    <a
                      className="inline-flex h-8 items-center gap-2 rounded-lg bg-white px-2.5 text-sm font-semibold ring-1 ring-zinc-oscuro hover:bg-zinc"
                      href={`https://wa.me/?text=${encodeURIComponent(textoPedido(p, estado.ajustes.nombreLocal))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle aria-hidden className="size-4" /> WhatsApp
                    </a>
                    <Boton
                      tamano="pequeno"
                      variante="primario"
                      className="ml-auto"
                      onClick={() =>
                        setPedido({
                          proveedor: p.proveedor === "Sin proveedor" ? "" : p.proveedor,
                          lineas: p.lineas.map((l) => ({
                            ingredienteId: l.ingrediente.id,
                            cantidad: l.cantidad,
                            importe: l.importe,
                          })),
                        })
                      }
                    >
                      <Truck aria-hidden className="size-4" /> Ha llegado
                    </Boton>
                  </div>
                </section>
              ))}
            </div>
          ))}

        {pestana === "movimientos" && <Movimientos />}
      </div>

      <DialogoIngrediente
        ingrediente={editando === "nuevo" ? null : editando}
        abierto={editando !== null}
        alCerrar={() => setEditando(null)}
      />
      <DialogoAjuste ajuste={ajuste} alCerrar={() => setAjuste(null)} />
      <RecibirPedido
        inicial={pedido}
        alCerrar={() => setPedido(null)}
        leerFacturas={leerFacturas}
      />
    </main>
  );
}

function Movimientos() {
  const { estado } = useDatos();
  const movimientos = estado.movimientosStock.slice(-150).reverse();
  if (!movimientos.length)
    return (
      <Vacio titulo="Sin movimientos todavía">
        Aquí salen las compras, los recuentos y las mermas. Lo que se gasta al vender se descuenta
        solo y no se apunta uno a uno.
      </Vacio>
    );
  return (
    <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
      {movimientos.map((m) => {
        const ing = estado.ingredientes.find((i) => i.id === m.ingredienteId);
        const quien = estado.empleados.find((e) => e.id === m.empleadoId)?.nombre;
        return (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-28 shrink-0 text-sm text-tinta-suave">
              {formatearFechaHora(m.fecha)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{ing?.nombre ?? "Ingrediente borrado"}</span>
              <span className="block text-sm text-tinta-suave">
                {NOMBRE_MOVIMIENTO[m.tipo]}
                {m.nota && ` · ${m.nota}`}
                {quien && ` · ${quien}`}
              </span>
            </span>
            <span
              className={clsx(
                "font-semibold tabular-nums",
                m.cantidad < 0 ? "text-aviso" : "text-cuenta",
              )}
            >
              {m.cantidad > 0 ? "+" : ""}
              {ing ? formatearCantidad(m.cantidad, ing.unidad) : m.cantidad}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
