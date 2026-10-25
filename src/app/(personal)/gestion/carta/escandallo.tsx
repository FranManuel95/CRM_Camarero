"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Boton, claseEntrada } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import { costeReceta, hayParaUnaMas, leerCantidad } from "@/lib/dominio/stock";
import type { Centimos, Ingrediente, LineaReceta } from "@/lib/dominio/tipos";

/** Una línea del escandallo mientras se edita (la cantidad, como la escribe el encargado). */
export type LineaBorrador = { ingredienteId: string; cantidad: string };

export const aBorrador = (receta: LineaReceta[] = []): LineaBorrador[] =>
  receta.map((r) => ({
    ingredienteId: r.ingredienteId,
    cantidad: String(r.cantidad).replace(".", ","),
  }));

/** Las líneas completas y bien escritas; las vacías se ignoran. Null si alguna está mal. */
export function leerReceta(lineas: LineaBorrador[]): LineaReceta[] | null {
  const receta: LineaReceta[] = [];
  for (const l of lineas) {
    if (!l.ingredienteId && !l.cantidad.trim()) continue;
    const cantidad = leerCantidad(l.cantidad);
    if (!l.ingredienteId || cantidad === null || cantidad <= 0) return null;
    receta.push({ ingredienteId: l.ingredienteId, cantidad });
  }
  return receta;
}

/**
 * Lo que lleva una ración: al mandarla a cocina se descuenta del stock, y su coste sale de aquí.
 */
export function Escandallo({
  lineas,
  alCambiar,
  ingredientes,
  precio,
}: {
  lineas: LineaBorrador[];
  alCambiar: (lineas: LineaBorrador[]) => void;
  ingredientes: Ingrediente[];
  /** Precio de venta con IVA, para enseñar el margen. */
  precio: Centimos | null;
}) {
  const ordenados = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const receta = leerReceta(lineas);
  const coste = receta?.length ? costeReceta(receta, ingredientes) : null;
  // El margen se mira sin IVA (10 % en hostelería), igual que en los informes.
  const margen = coste !== null && precio ? Math.round((1 - coste / (precio / 1.1)) * 100) : null;
  const sinStock = receta?.length ? !hayParaUnaMas({ receta }, ingredientes) : false;

  function cambiar(i: number, cambios: Partial<LineaBorrador>) {
    alCambiar(lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  }

  return (
    <fieldset className="rounded-xl bg-zinc-claro p-3 sm:col-span-2">
      <legend className="sr-only">Escandallo</legend>
      <p className="mb-1 font-semibold" aria-hidden>
        Escandallo
      </p>
      <p className="mb-2 text-sm text-tinta-suave">
        Lo que lleva una ración. Al mandarla a cocina se descuenta del stock y, si algo se acaba, el
        plato se pone agotado solo.
      </p>
      {ingredientes.length === 0 ? (
        <p className="text-sm">
          Primero da de alta los ingredientes en{" "}
          <Link href="/gestion/stock" className="font-semibold text-cobalto underline">
            Stock
          </Link>
          .
        </p>
      ) : (
        <>
          <ul className="grid gap-2">
            {lineas.map((l, i) => {
              const ing = ingredientes.find((x) => x.id === l.ingredienteId);
              return (
                <li key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                  <select
                    aria-label={`Ingrediente ${i + 1} del escandallo`}
                    className={claseEntrada}
                    value={l.ingredienteId}
                    onChange={(e) => cambiar(i, { ingredienteId: e.target.value })}
                  >
                    <option value="">Elige…</option>
                    {ordenados.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="relative">
                    <input
                      aria-label={`Cantidad del ingrediente ${i + 1}${ing ? ` (${ing.unidad})` : ""}`}
                      inputMode="decimal"
                      className={`${claseEntrada} pr-9`}
                      value={l.cantidad}
                      onChange={(e) => cambiar(i, { cantidad: e.target.value })}
                      placeholder="0"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-tinta-suave"
                    >
                      {ing?.unidad}
                    </span>
                  </span>
                  <Boton
                    variante="fantasma"
                    aria-label={`Quitar el ingrediente ${i + 1}`}
                    onClick={() => alCambiar(lineas.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Boton>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Boton
              tamano="pequeno"
              onClick={() => alCambiar([...lineas, { ingredienteId: "", cantidad: "" }])}
            >
              <Plus aria-hidden className="size-4" /> Añadir ingrediente
            </Boton>
            <p className="ml-auto text-sm" aria-live="polite">
              {receta === null ? (
                <span className="font-semibold text-aviso">Revisa las cantidades.</span>
              ) : coste !== null ? (
                <>
                  Coste de la ración: <span className="font-semibold">{euros(coste)}</span>
                  {margen !== null && ` · margen ${margen} %`}
                </>
              ) : null}
            </p>
          </div>
          {sinStock && (
            <p className="mt-2 text-sm font-semibold text-aviso">
              Ahora no hay stock para una ración: el plato saldrá agotado hasta que entre género.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
