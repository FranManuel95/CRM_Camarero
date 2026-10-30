"use client";

import clsx from "clsx";
import { Minus, MoreHorizontal, Plus, Search, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { useAhora } from "@/lib/cliente/use-ahora";
import { precioConTarifa } from "@/lib/dominio/tarifas";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor, Vacio } from "@/components/ui";
import type { LineaPedida } from "@/lib/dominio/acciones";
import { euros } from "@/lib/dominio/importes";
import type { Producto } from "@/lib/dominio/tipos";

export type Anotar = (linea: LineaPedida) => Promise<boolean>;

/**
 * La carta para el camarero: categorías, buscador y botones grandes. Tocar un plato lo anota; los
 * que tienen opciones (o el botón «…») abren el detalle con cantidad, nota y «para después».
 * Lo oculto no lo ve el camarero; el encargado ve lo oculto y lo agotado (en gris) y puede
 * anotarlo igualmente, sin tener que ir a cambiar la carta.
 */
const RAPIDOS = "rapidos";

export function CartaTpv({
  alAnotar,
  permitirDespues = false,
  zonaId = null,
}: {
  alAnotar: Anotar;
  permitirDespues?: boolean;
  /** Zona de la mesa, para enseñar los precios especiales que tocan (terraza…). */
  zonaId?: string | null;
}) {
  const { estado, empleado } = useDatos();
  const conTarifas = useFuncion("tarifas");
  const ahora = useAhora(60_000);
  const precioDe = (p: Producto) =>
    conTarifas ? precioConTarifa(estado, p, zonaId, ahora) : { precio: p.precio };
  const encargado = empleado.rol === "encargado";
  const categorias = useMemo(
    () => [...estado.categorias].sort((a, b) => a.orden - b.orden),
    [estado.categorias],
  );
  // «Rápidos»: lo que más se pide a esta hora, a un toque (si hay historia suficiente).
  const rapidos = useMemo(() => {
    // Lo calcula el servidor con las últimas semanas (aquí solo llegan los tickets de hoy).
    const nombres = estado.rapidos ?? [];
    return nombres
      .map((n) => estado.productos.find((p) => p.nombre === n))
      .filter((p): p is Producto => Boolean(p && !p.oculto && p.disponible));
  }, [estado.rapidos, estado.productos]);
  const hayRapidos = rapidos.length >= 4;
  const [categoriaId, setCategoriaId] = useState(hayRapidos ? RAPIDOS : (categorias[0]?.id ?? ""));
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<Producto | null>(null);

  const termino = busqueda.trim().toLowerCase();
  const productos =
    !termino && categoriaId === RAPIDOS
      ? rapidos
      : estado.productos
          .filter((p) => encargado || !p.oculto)
          .filter((p) =>
            termino ? p.nombre.toLowerCase().includes(termino) : p.categoriaId === categoriaId,
          )
          .sort((a, b) => a.orden - b.orden);

  function tocar(p: Producto) {
    if (p.grupos.length) setDetalle(p);
    else void alAnotar({ productoId: p.id, cantidad: 1, opciones: [], nota: "" });
  }

  return (
    <>
      <div className="relative mb-3">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-3 left-3 size-5 text-tinta-suave"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la carta…"
          aria-label="Buscar en la carta"
          className={clsx(claseEntrada, "pl-10")}
        />
      </div>
      {!termino && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Categorías">
          {hayRapidos && (
            <button
              role="tab"
              type="button"
              aria-selected={categoriaId === RAPIDOS}
              onClick={() => setCategoriaId(RAPIDOS)}
              title="Lo que más se pide a esta hora"
              className={clsx(
                "inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-semibold",
                categoriaId === RAPIDOS
                  ? "bg-cobalto text-white"
                  : "bg-cobalto-claro text-cobalto-oscuro ring-1 ring-cobalto",
              )}
            >
              <Zap aria-hidden className="size-4" /> Rápidos
            </button>
          )}
          {categorias.map((c) => (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={c.id === categoriaId}
              onClick={() => setCategoriaId(c.id)}
              className={clsx(
                "h-10 rounded-full px-4 text-sm font-semibold",
                c.id === categoriaId ? "bg-tinta text-white" : "bg-white ring-1 ring-zinc-oscuro",
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {productos.map((p) => {
          const fuera = p.oculto || !p.disponible;
          return (
            <li key={p.id} className="relative">
              <button
                type="button"
                disabled={fuera && !encargado}
                onClick={() => tocar(p)}
                className={clsx(
                  "flex h-24 w-full flex-col justify-between rounded-xl bg-white p-3 text-left ring-1 ring-zinc-oscuro transition hover:ring-cobalto active:scale-[0.97] disabled:opacity-45",
                  fuera &&
                    encargado &&
                    "border-2 border-dashed border-zinc-oscuro bg-zinc-claro ring-0",
                )}
              >
                <span className="line-clamp-2 pr-7 leading-tight font-semibold">{p.nombre}</span>
                <span className="text-sm text-tinta-suave">
                  {p.oculto ? (
                    <span className="font-semibold">Oculto · {euros(precioDe(p).precio)}</span>
                  ) : !p.disponible ? (
                    <span className="font-semibold">
                      Agotado{encargado ? ` · ${euros(precioDe(p).precio)}` : ""}
                    </span>
                  ) : precioDe(p).tarifa ? (
                    <span>
                      <span className="font-semibold text-cuenta">{euros(precioDe(p).precio)}</span>{" "}
                      <span className="line-through">{euros(p.precio)}</span>
                    </span>
                  ) : (
                    euros(p.precio)
                  )}
                  {p.grupos.length > 0 && " · elegir"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDetalle(p)}
                disabled={fuera && !encargado}
                className="absolute top-1 right-1 rounded-lg p-2 text-tinta-suave hover:bg-zinc disabled:hidden"
                aria-label={`Más opciones de ${p.nombre}: cantidad y nota`}
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {productos.length === 0 && (
        <Vacio titulo="Nada por aquí">
          {termino ? "Prueba con otra palabra." : "Esta categoría está vacía."}
        </Vacio>
      )}
      {detalle && (
        <DetalleProducto
          producto={detalle}
          alAnotar={alAnotar}
          permitirDespues={permitirDespues}
          alCerrar={() => setDetalle(null)}
        />
      )}
    </>
  );
}

/** Elegir opciones, cantidad y nota de un producto antes de anotarlo. */
function DetalleProducto({
  producto,
  alCerrar,
  alAnotar,
  permitirDespues,
}: {
  producto: Producto;
  alCerrar: () => void;
  alAnotar: Anotar;
  permitirDespues: boolean;
}) {
  const { estado, empleado, hacer } = useDatos();
  // El producto al día (si se cambia su disponibilidad aquí mismo, se ve al momento).
  const actual = estado.productos.find((p) => p.id === producto.id) ?? producto;
  const encargado = empleado.rol === "encargado";
  const [despues, setDespues] = useState(false);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const faltan = producto.grupos.filter(
    (g) => g.obligatorio && !g.opciones.some((o) => elegidas.includes(o.id)),
  );
  const suplemento = producto.grupos
    .flatMap((g) => g.opciones)
    .filter((o) => elegidas.includes(o.id))
    .reduce((s, o) => s + o.suplemento, 0);

  function elegir(grupoId: string, opcionId: string) {
    const grupo = producto.grupos.find((g) => g.id === grupoId)!;
    setElegidas((actuales) => {
      if (grupo.multiple)
        return actuales.includes(opcionId)
          ? actuales.filter((i) => i !== opcionId)
          : [...actuales, opcionId];
      const sinGrupo = actuales.filter((i) => !grupo.opciones.some((o) => o.id === i));
      return actuales.includes(opcionId) ? sinGrupo : [...sinGrupo, opcionId];
    });
  }

  async function anotar() {
    const ok = await alAnotar({
      productoId: producto.id,
      cantidad,
      opciones: elegidas,
      nota: nota.trim(),
      ...(despues ? { despues: true } : {}),
    });
    if (ok) alCerrar();
  }

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo={producto.nombre}>
      {producto.grupos.map((g) => (
        <fieldset key={g.id} className="mb-4">
          <legend className="mb-2 font-semibold">
            {g.nombre}
            <span className="ml-2 text-sm font-normal text-tinta-suave">
              {g.obligatorio ? "Obligatorio" : "Opcional"}
              {g.multiple ? " · varias" : ""}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {g.opciones.map((o) => {
              const activa = elegidas.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => elegir(g.id, o.id)}
                  className={clsx(
                    "h-11 rounded-lg px-3 font-medium ring-1",
                    activa ? "bg-cobalto text-white ring-cobalto" : "bg-white ring-zinc-oscuro",
                  )}
                >
                  {o.nombre}
                  {o.suplemento > 0 && ` +${euros(o.suplemento)}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Campo etiqueta="Nota para cocina o barra" className="mb-4">
        <input
          className={claseEntrada}
          value={nota}
          maxLength={140}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Sin cebolla, para compartir…"
        />
      </Campo>
      {permitirDespues && (
        <div className="mb-4">
          <Interruptor
            activo={despues}
            alCambiar={setDespues}
            etiqueta="Para después"
            ayuda="Cocina lo ve, pero no lo prepara hasta que pulses «Marcha»."
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Cantidad">
          <Boton aria-label="Una menos" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
            <Minus aria-hidden className="size-4" />
          </Boton>
          <span className="w-8 text-center font-rotulo text-2xl font-bold" aria-live="polite">
            {cantidad}
          </span>
          <Boton aria-label="Una más" onClick={() => setCantidad((c) => Math.min(99, c + 1))}>
            <Plus aria-hidden className="size-4" />
          </Boton>
        </div>
        <Boton variante="primario" tamano="grande" disabled={faltan.length > 0} onClick={anotar}>
          Anotar · {euros((producto.precio + suplemento) * cantidad)}
        </Boton>
      </div>
      {faltan.length > 0 && (
        <p className="mt-2 text-right text-sm text-tinta-suave">
          Falta elegir: {faltan.map((g) => g.nombre.toLowerCase()).join(", ")}
        </p>
      )}
      <fieldset className="mt-5 border-t border-zinc pt-3">
        <legend className="sr-only">En la carta</legend>
        <p className="mb-2 text-sm font-semibold">En la carta</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["disponible", "Disponible", true, false],
              ["agotado", "Agotado hoy", false, false],
              ...(encargado ? ([["oculto", "Oculto", true, true]] as const) : []),
            ] as const
          ).map(([clave, texto, disponible, oculto]) => {
            const activa =
              clave === "oculto"
                ? Boolean(actual.oculto)
                : !actual.oculto && actual.disponible === disponible;
            return (
              <Boton
                key={clave}
                tamano="pequeno"
                variante={activa ? "primario" : "secundario"}
                aria-pressed={activa}
                onClick={() =>
                  hacer(
                    {
                      tipo: "cambiar_disponible",
                      productoId: actual.id,
                      disponible,
                      ...(encargado ? { oculto } : {}),
                    },
                    `${actual.nombre}: ${texto.toLowerCase()}`,
                  )
                }
              >
                {texto}
              </Boton>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          {encargado
            ? "Oculto: no lo ven ni los clientes ni los camareros. Tú puedes anotarlo igualmente."
            : "Agotado: sale en gris y no se puede pedir hasta que vuelva a haber."}
        </p>
      </fieldset>
    </Dialogo>
  );
}
