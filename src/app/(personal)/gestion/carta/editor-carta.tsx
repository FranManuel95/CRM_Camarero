"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor, Vacio } from "@/components/ui";
import { euros, leerEuros } from "@/lib/dominio/importes";
import {
  ALERGENOS,
  type Categoria,
  type GrupoOpciones,
  NOMBRE_ALERGENO,
  type Producto,
} from "@/lib/dominio/tipos";

const nuevoId = () => Math.random().toString(36).slice(2, 10);
const aTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

type BorradorProducto = Omit<Producto, "id" | "precio" | "coste" | "grupos"> & {
  id?: string;
  precio: string;
  coste: string;
  grupos: (Omit<GrupoOpciones, "opciones"> & {
    opciones: { id: string; nombre: string; suplemento: string }[];
  })[];
};

export function EditorCarta() {
  const { estado, hacer } = useDatos();
  const categorias = [...estado.categorias].sort((a, b) => a.orden - b.orden);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [cat, setCat] = useState<(Omit<Categoria, "id"> & { id?: string }) | null>(null);
  const [prod, setProd] = useState<BorradorProducto | null>(null);
  const actual = categorias.find((c) => c.id === categoriaId);
  const productos = estado.productos
    .filter((p) => p.categoriaId === categoriaId)
    .sort((a, b) => a.orden - b.orden);

  function nuevoProducto() {
    setProd({
      categoriaId,
      nombre: "",
      descripcion: "",
      precio: "",
      iva: estado.ajustes.ivaPorDefecto,
      alergenos: [],
      disponible: true,
      orden: (productos.at(-1)?.orden ?? -1) + 1,
      grupos: [],
      coste: "",
    });
  }

  function editarProducto(p: Producto) {
    setProd({
      ...p,
      precio: aTexto(p.precio),
      coste: p.coste === undefined ? "" : aTexto(p.coste),
      grupos: p.grupos.map((g) => ({
        ...g,
        opciones: g.opciones.map((o) => ({
          ...o,
          suplemento: o.suplemento ? aTexto(o.suplemento) : "",
        })),
      })),
    });
  }

  async function guardarProducto() {
    if (!prod) return;
    const precio = leerEuros(prod.precio);
    if (precio === null) return;
    const coste = prod.coste ? (leerEuros(prod.coste) ?? undefined) : undefined;
    const ok = await hacer(
      {
        tipo: "guardar_producto",
        producto: {
          ...prod,
          precio,
          coste,
          grupos: prod.grupos.map((g) => ({
            ...g,
            opciones: g.opciones
              .filter((o) => o.nombre.trim())
              .map((o) => ({ ...o, suplemento: leerEuros(o.suplemento || "0") ?? 0 })),
          })),
        },
      },
      "Guardado en la carta",
    );
    if (ok) setProd(null);
  }

  async function mover(p: Producto, dir: -1 | 1) {
    const i = productos.findIndex((x) => x.id === p.id);
    const otro = productos[i + dir];
    if (!otro) return;
    await hacer({ tipo: "guardar_producto", producto: { ...p, orden: otro.orden } });
    await hacer({ tipo: "guardar_producto", producto: { ...otro, orden: p.orden } });
  }

  return (
    <main>
      <h1 className="mb-4 font-rotulo text-4xl font-bold">Carta</h1>
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <section aria-labelledby="t-cats">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="t-cats" className="font-rotulo text-2xl font-bold">
              Categorías
            </h2>
            <Boton
              tamano="pequeno"
              onClick={() =>
                setCat({
                  nombre: "",
                  orden: (categorias.at(-1)?.orden ?? -1) + 1,
                  destino: "cocina",
                  visibleEnQR: true,
                })
              }
            >
              <Plus aria-hidden className="size-4" /> Nueva
            </Boton>
          </div>
          <ul className="space-y-1">
            {categorias.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  aria-current={c.id === categoriaId}
                  className={clsx(
                    "flex h-11 flex-1 items-center justify-between rounded-lg px-3 text-left font-semibold",
                    c.id === categoriaId
                      ? "bg-tinta text-white"
                      : "bg-white ring-1 ring-zinc hover:bg-zinc-claro",
                  )}
                >
                  <span>{c.nombre}</span>
                  <span className="text-xs font-normal opacity-75">
                    {c.destino === "barra" ? "Barra" : "Cocina"}
                    {!c.visibleEnQR && " · oculta en QR"}
                  </span>
                </button>
                <Boton
                  tamano="pequeno"
                  variante="fantasma"
                  aria-label={`Editar ${c.nombre}`}
                  onClick={() => setCat(c)}
                >
                  <Pencil aria-hidden className="size-4" />
                </Boton>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="t-prods">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="t-prods" className="font-rotulo text-2xl font-bold">
              {actual?.nombre ?? "Productos"}
            </h2>
            {actual && (
              <Boton variante="primario" onClick={nuevoProducto}>
                <Plus aria-hidden className="size-4" /> Añadir producto
              </Boton>
            )}
          </div>
          {productos.length === 0 ? (
            <Vacio titulo="Sin productos">Añade el primero de esta categoría.</Vacio>
          ) : (
            <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
              {productos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => mover(p, -1)}
                      className="rounded p-0.5 hover:bg-zinc disabled:opacity-20"
                      aria-label={`Subir ${p.nombre}`}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={i === productos.length - 1}
                      onClick={() => mover(p, 1)}
                      className="rounded p-0.5 hover:bg-zinc disabled:opacity-20"
                      aria-label={`Bajar ${p.nombre}`}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "font-semibold",
                        !p.disponible && "text-tinta-suave line-through",
                      )}
                    >
                      {p.nombre}
                    </p>
                    <p className="truncate text-sm text-tinta-suave">
                      {p.alergenos.length
                        ? p.alergenos.map((a) => NOMBRE_ALERGENO[a]).join(", ")
                        : "Sin alérgenos declarados"}
                      {p.grupos.length > 0 && ` · ${p.grupos.map((g) => g.nombre).join(", ")}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{euros(p.precio)}</span>
                  <Boton
                    tamano="pequeno"
                    variante={p.disponible ? "fantasma" : "secundario"}
                    onClick={() =>
                      hacer(
                        { tipo: "cambiar_disponible", productoId: p.id, disponible: !p.disponible },
                        p.disponible ? `${p.nombre}: agotado` : `${p.nombre}: disponible`,
                      )
                    }
                  >
                    {p.disponible ? (
                      <Eye aria-hidden className="size-4" />
                    ) : (
                      <EyeOff aria-hidden className="size-4" />
                    )}
                    {p.disponible ? "Disponible" : "Agotado"}
                  </Boton>
                  <Boton
                    tamano="pequeno"
                    variante="fantasma"
                    aria-label={`Editar ${p.nombre}`}
                    onClick={() => editarProducto(p)}
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialogo
        abierto={cat !== null}
        alCerrar={() => setCat(null)}
        titulo={cat?.id ? "Editar categoría" : "Nueva categoría"}
      >
        {cat && (
          <div className="space-y-4">
            <Campo etiqueta="Nombre">
              <input
                className={claseEntrada}
                value={cat.nombre}
                onChange={(e) => setCat({ ...cat, nombre: e.target.value })}
                placeholder="Tapas"
              />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">¿Quién lo prepara?</legend>
              <div className="flex gap-2">
                {(["cocina", "barra"] as const).map((d) => (
                  <Boton
                    key={d}
                    variante={cat.destino === d ? "primario" : "secundario"}
                    onClick={() => setCat({ ...cat, destino: d })}
                  >
                    {d === "cocina" ? "Cocina" : "Barra"}
                  </Boton>
                ))}
              </div>
              <p className="mt-1 text-xs text-tinta-suave">
                Decide a qué pantalla e impresora va la comanda.
              </p>
            </fieldset>
            <Interruptor
              activo={cat.visibleEnQR}
              alCambiar={(v) => setCat({ ...cat, visibleEnQR: v })}
              etiqueta="Se ve en la carta QR"
              ayuda="Quítalo para cosas que solo marca el camarero (menú del día, extras de barra…)."
            />
            <div className="flex justify-between gap-2">
              {cat.id ? (
                <Boton
                  variante="peligro"
                  onClick={async () => {
                    if (
                      confirm(`¿Borrar la categoría «${cat.nombre}»?`) &&
                      (await hacer(
                        { tipo: "borrar_categoria", categoriaId: cat.id! },
                        "Categoría borrada",
                      ))
                    )
                      setCat(null);
                  }}
                >
                  <Trash2 aria-hidden className="size-4" /> Borrar
                </Boton>
              ) : (
                <span />
              )}
              <Boton
                variante="primario"
                disabled={!cat.nombre.trim()}
                onClick={async () => {
                  if (
                    await hacer({ tipo: "guardar_categoria", categoria: cat }, "Categoría guardada")
                  )
                    setCat(null);
                }}
              >
                Guardar
              </Boton>
            </div>
          </div>
        )}
      </Dialogo>

      <Dialogo
        abierto={prod !== null}
        alCerrar={() => setProd(null)}
        titulo={prod?.id ? "Editar producto" : "Nuevo producto"}
        ancho="max-w-2xl"
      >
        {prod && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" className="sm:col-span-2">
              <input
                className={claseEntrada}
                value={prod.nombre}
                onChange={(e) => setProd({ ...prod, nombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Descripción (sale en la carta QR)" className="sm:col-span-2">
              <textarea
                className={clsx(claseEntrada, "h-20 py-2")}
                value={prod.descripcion}
                maxLength={400}
                onChange={(e) => setProd({ ...prod, descripcion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Precio (IVA incluido)">
              <input
                className={claseEntrada}
                inputMode="decimal"
                value={prod.precio}
                onChange={(e) => setProd({ ...prod, precio: e.target.value })}
                placeholder="0,00"
              />
            </Campo>
            <Campo etiqueta="IVA">
              <select
                className={claseEntrada}
                value={prod.iva}
                onChange={(e) => setProd({ ...prod, iva: Number(e.target.value) })}
              >
                {[10, 21, 4, 0].map((i) => (
                  <option key={i} value={i}>
                    {i} %{i === 10 ? " (hostelería)" : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Categoría">
              <select
                className={claseEntrada}
                value={prod.categoriaId}
                onChange={(e) => setProd({ ...prod, categoriaId: e.target.value })}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              etiqueta="Coste de la ración (opcional)"
              ayuda="Para ver el margen en los informes."
            >
              <input
                className={claseEntrada}
                inputMode="decimal"
                value={prod.coste}
                onChange={(e) => setProd({ ...prod, coste: e.target.value })}
                placeholder="0,00"
              />
            </Campo>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">Alérgenos</legend>
              <div className="flex flex-wrap gap-1.5">
                {ALERGENOS.map((a) => {
                  const activo = prod.alergenos.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={activo}
                      onClick={() =>
                        setProd({
                          ...prod,
                          alergenos: activo
                            ? prod.alergenos.filter((x) => x !== a)
                            : [...prod.alergenos, a],
                        })
                      }
                      className={clsx(
                        "h-9 rounded-full px-3 text-sm ring-1",
                        activo ? "bg-tinta text-white ring-tinta" : "bg-white ring-zinc-oscuro",
                      )}
                    >
                      {NOMBRE_ALERGENO[a]}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">Opciones y extras</legend>
              {prod.grupos.map((g, gi) => {
                const cambiarGrupo = (cambios: Partial<BorradorProducto["grupos"][number]>) =>
                  setProd({
                    ...prod,
                    grupos: prod.grupos.map((x, i) => (i === gi ? { ...x, ...cambios } : x)),
                  });
                return (
                  <div key={g.id} className="mb-3 rounded-xl bg-zinc-claro p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        className={clsx(claseEntrada, "flex-1")}
                        value={g.nombre}
                        placeholder="Punto, Extras, Leche…"
                        aria-label="Nombre del grupo"
                        onChange={(e) => cambiarGrupo({ nombre: e.target.value })}
                      />
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={g.obligatorio}
                          onChange={(e) => cambiarGrupo({ obligatorio: e.target.checked })}
                        />{" "}
                        Obligatorio
                      </label>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={g.multiple}
                          onChange={(e) => cambiarGrupo({ multiple: e.target.checked })}
                        />{" "}
                        Varias
                      </label>
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        aria-label="Quitar grupo"
                        onClick={() =>
                          setProd({ ...prod, grupos: prod.grupos.filter((_, i) => i !== gi) })
                        }
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Boton>
                    </div>
                    {g.opciones.map((o, oi) => (
                      <div key={o.id} className="mb-1 flex gap-2">
                        <input
                          className={clsx(claseEntrada, "flex-1")}
                          value={o.nombre}
                          placeholder="Opción"
                          aria-label="Nombre de la opción"
                          onChange={(e) =>
                            cambiarGrupo({
                              opciones: g.opciones.map((x, i) =>
                                i === oi ? { ...x, nombre: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <input
                          className={clsx(claseEntrada, "w-28")}
                          value={o.suplemento}
                          inputMode="decimal"
                          placeholder="+0,00"
                          aria-label="Suplemento"
                          onChange={(e) =>
                            cambiarGrupo({
                              opciones: g.opciones.map((x, i) =>
                                i === oi ? { ...x, suplemento: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <Boton
                          tamano="pequeno"
                          variante="fantasma"
                          aria-label="Quitar opción"
                          className="h-11"
                          onClick={() =>
                            cambiarGrupo({ opciones: g.opciones.filter((_, i) => i !== oi) })
                          }
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Boton>
                      </div>
                    ))}
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      onClick={() =>
                        cambiarGrupo({
                          opciones: [...g.opciones, { id: nuevoId(), nombre: "", suplemento: "" }],
                        })
                      }
                    >
                      <Plus aria-hidden className="size-4" /> Opción
                    </Boton>
                  </div>
                );
              })}
              <Boton
                tamano="pequeno"
                onClick={() =>
                  setProd({
                    ...prod,
                    grupos: [
                      ...prod.grupos,
                      {
                        id: nuevoId(),
                        nombre: "",
                        obligatorio: false,
                        multiple: false,
                        opciones: [{ id: nuevoId(), nombre: "", suplemento: "" }],
                      },
                    ],
                  })
                }
              >
                <Plus aria-hidden className="size-4" /> Añadir grupo de opciones
              </Boton>
            </fieldset>

            <div className="flex justify-between gap-2 sm:col-span-2">
              {prod.id ? (
                <Boton
                  variante="peligro"
                  onClick={async () => {
                    if (
                      confirm(`¿Borrar «${prod.nombre}» de la carta?`) &&
                      (await hacer(
                        { tipo: "borrar_producto", productoId: prod.id! },
                        "Producto borrado",
                      ))
                    )
                      setProd(null);
                  }}
                >
                  <Trash2 aria-hidden className="size-4" /> Borrar
                </Boton>
              ) : (
                <span />
              )}
              <Boton
                variante="primario"
                disabled={!prod.nombre.trim() || leerEuros(prod.precio) === null}
                onClick={guardarProducto}
              >
                Guardar
              </Boton>
            </div>
          </div>
        )}
      </Dialogo>
    </main>
  );
}
