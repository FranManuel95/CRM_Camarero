"use client";

import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import { propuestaPrecios, type Redondeo } from "@/lib/dominio/precios-carta";

const REDONDEOS: { valor: Redondeo; texto: string }[] = [
  { valor: 0, texto: "Sin redondear" },
  { valor: 5, texto: "A 0,05 €" },
  { valor: 10, texto: "A 0,10 €" },
  { valor: 50, texto: "A 0,50 €" },
];

/** Subir (o bajar) los precios de varias categorías de una vez, viendo antes cómo quedan. */
export function SubirPrecios() {
  const { estado, hacer } = useDatos();
  const [abierto, setAbierto] = useState(false);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [porcentaje, setPorcentaje] = useState("5");
  const [redondeo, setRedondeo] = useState<Redondeo>(10);
  const pct = Number(porcentaje.replace(",", "."));
  const valido = Number.isFinite(pct) && pct !== 0 && pct >= -50 && pct <= 100;
  const cambios = valido ? propuestaPrecios(estado, categoriaIds, pct, redondeo) : [];
  const categorias = [...estado.categorias].sort((a, b) => a.orden - b.orden);

  async function aplicar() {
    const ok = await hacer(
      { tipo: "subir_precios", categoriaIds, porcentaje: pct, redondeo },
      `Precios cambiados: ${cambios.length} productos`,
    );
    if (ok) setAbierto(false);
  }

  return (
    <section className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-subir">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="t-subir" className="mr-auto font-rotulo text-2xl font-bold">
          Subir o bajar precios de golpe
        </h2>
        <Boton onClick={() => setAbierto(true)}>
          <TrendingUp aria-hidden className="size-4" /> Cambiar precios
        </Boton>
      </div>
      <p className="mt-1 text-sm text-tinta-suave">
        Por ejemplo, toda la bebida un 5 % más, redondeado a 0,10 €. Antes de aplicarlo ves cómo
        queda cada precio.
      </p>
      <Dialogo
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Cambiar precios de golpe"
        ancho="max-w-2xl"
      >
        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-semibold">
            Qué categorías (ninguna marcada = toda la carta)
          </legend>
          <div className="flex flex-wrap gap-1">
            {categorias.map((c) => {
              const marcada = categoriaIds.includes(c.id);
              return (
                <Boton
                  key={c.id}
                  tamano="pequeno"
                  aria-pressed={marcada}
                  variante={marcada ? "primario" : "secundario"}
                  onClick={() =>
                    setCategoriaIds((ids) =>
                      marcada ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                    )
                  }
                >
                  {c.nombre}
                </Boton>
              );
            })}
          </div>
        </fieldset>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Campo etiqueta="Cuánto (%)" ayuda="En negativo, para bajar: −10.">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Redondear">
            <select
              className={claseEntrada}
              value={redondeo}
              onChange={(e) => setRedondeo(Number(e.target.value) as Redondeo)}
            >
              {REDONDEOS.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div
          className="mb-3 max-h-72 overflow-auto rounded-lg ring-1 ring-zinc"
          tabIndex={0}
          role="region"
          aria-label="Cómo quedan los precios"
        >
          {cambios.length === 0 ? (
            <p className="p-3 text-sm text-tinta-suave">
              {valido ? "Con esto no cambia ningún precio." : "Pon un porcentaje entre −50 y 100."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Precio de ahora y precio nuevo de cada producto</caption>
              <thead className="sticky top-0 bg-white text-tinta-suave">
                <tr>
                  <th scope="col" className="p-2 text-left font-semibold">
                    Producto
                  </th>
                  <th scope="col" className="p-2 text-right font-semibold">
                    Ahora
                  </th>
                  <th scope="col" className="p-2 text-right font-semibold">
                    Nuevo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc">
                {cambios.map((c) => (
                  <tr key={c.producto.id} className="tabular-nums">
                    <th scope="row" className="p-2 text-left font-normal">
                      {c.producto.nombre}
                    </th>
                    <td className="p-2 text-right text-tinta-suave">{euros(c.antes)}</td>
                    <td className="p-2 text-right font-semibold">{euros(c.despues)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
          <Boton variante="primario" disabled={!cambios.length} onClick={aplicar}>
            Cambiar {cambios.length} {cambios.length === 1 ? "precio" : "precios"}
          </Boton>
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          Los suplementos de las opciones (extras, tamaños) no cambian. Queda apuntado en el
          historial.
        </p>
      </Dialogo>
    </section>
  );
}
