"use client";

import clsx from "clsx";
import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import {
  aplicarDescuento,
  euros,
  importeLinea,
  leerEuros,
  lineasCobrables,
  precioConOpciones,
  precioFinal,
  subtotalCuenta,
  totalCuenta,
} from "@/lib/dominio/importes";
import type { Cuenta } from "@/lib/dominio/tipos";

const PORCENTAJES = [5, 10, 15, 20, 25, 50];

/**
 * Precios y descuentos de una cuenta, todo en un sitio y a un toque: subir o bajar el precio de
 * uno o varios artículos, descontarles un %, o descontar toda la cuenta en % o en euros (también
 * «cóbrale justo 20 €»). Queda apuntado en el historial quién lo hizo.
 */
export function PreciosYDescuentos({
  abierto,
  cuenta,
  alCerrar,
  preseleccion,
}: {
  abierto: boolean;
  cuenta: Cuenta;
  alCerrar: () => void;
  /** Si se abre tocando el precio de una línea, esa línea ya marcada. */
  preseleccion?: string[];
}) {
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Precios y descuentos" ancho="max-w-2xl">
      {/* Se monta de nuevo cada vez que se abre: así empieza con la selección que toca. */}
      {abierto && <Contenido cuenta={cuenta} alCerrar={alCerrar} preseleccion={preseleccion} />}
    </Dialogo>
  );
}

function Contenido({
  cuenta,
  alCerrar,
  preseleccion,
}: {
  cuenta: Cuenta;
  alCerrar: () => void;
  preseleccion?: string[];
}) {
  const { hacer } = useDatos();
  const lineas = lineasCobrables(cuenta);
  const [modo, setModo] = useState<"articulos" | "cuenta">(
    preseleccion?.length ? "articulos" : "cuenta",
  );
  const [marcadas, setMarcadas] = useState<string[]>(preseleccion ?? []);
  const [precio, setPrecio] = useState("");
  const [otroPorcentaje, setOtroPorcentaje] = useState("");
  const [enEuros, setEnEuros] = useState("");
  const [cobrarJusto, setCobrarJusto] = useState("");

  const conPorcentaje = aplicarDescuento(subtotalCuenta(cuenta), cuenta.descuento);
  const total = totalCuenta(cuenta);
  const todas = lineas.length > 0 && marcadas.length === lineas.length;
  const unaSola = marcadas.length === 1 ? lineas.find((l) => l.id === marcadas[0]) : undefined;

  const ajustar = (
    cambio:
      | { tipo: "precio"; precio: number }
      | { tipo: "descuento"; porcentaje: number }
      | { tipo: "original" },
    mensaje: string,
  ) => hacer({ tipo: "ajustar_lineas", cuentaId: cuenta.id, lineaIds: marcadas, cambio }, mensaje);

  const descuentoCuenta = (descuento: number, importe: number | undefined, mensaje: string) =>
    hacer({ tipo: "aplicar_descuento", cuentaId: cuenta.id, descuento, importe }, mensaje);

  const precioNuevo = leerEuros(precio);
  const otro = Number(otroPorcentaje.replace(",", "."));
  const euroNuevo = leerEuros(enEuros);
  const justo = leerEuros(cobrarJusto);

  return (
    <>
      <div
        className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-claro p-1"
        role="radiogroup"
        aria-label="A qué"
      >
        {(
          [
            ["cuenta", "Toda la cuenta"],
            ["articulos", "Algunos artículos"],
          ] as const
        ).map(([m, texto]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            onClick={() => setModo(m)}
            className={clsx(
              "h-10 rounded-md font-semibold",
              modo === m ? "bg-white shadow" : "text-tinta-suave",
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === "articulos" ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Toca los artículos</p>
            <Boton
              tamano="pequeno"
              variante="fantasma"
              onClick={() => setMarcadas(todas ? [] : lineas.map((l) => l.id))}
            >
              {todas ? "Ninguno" : "Todos"}
            </Boton>
          </div>
          <ul className="mb-4 max-h-60 divide-y divide-zinc overflow-y-auto rounded-xl ring-1 ring-zinc">
            {lineas.map((l) => {
              const marcada = marcadas.includes(l.id);
              const cambiada = l.precioCambiado !== undefined || Boolean(l.descuentoLinea);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-pressed={marcada}
                    onClick={() =>
                      setMarcadas((m) => (marcada ? m.filter((x) => x !== l.id) : [...m, l.id]))
                    }
                    className={clsx(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                      marcada && "bg-cobalto-claro",
                    )}
                  >
                    <span
                      aria-hidden
                      className={clsx(
                        "grid size-6 shrink-0 place-items-center rounded-md ring-2",
                        marcada ? "bg-cobalto text-white ring-cobalto" : "ring-zinc-oscuro",
                      )}
                    >
                      {marcada && <Check className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {l.cantidad} × {l.nombre}
                      </span>
                      {l.invitacion && (
                        <span className="block text-xs text-cuenta">Invitación</span>
                      )}
                      {cambiada && (
                        <span className="block text-xs text-tinta-suave">
                          Carta: {euros(precioConOpciones(l))}/ud.
                          {l.precioCambiado !== undefined &&
                            ` · ahora ${euros(l.precioCambiado)}/ud.`}
                          {l.descuentoLinea ? ` · −${l.descuentoLinea} %` : ""}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">{euros(importeLinea(l))}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <fieldset disabled={!marcadas.length} className="space-y-4 disabled:opacity-50">
            <div>
              <p className="mb-2 font-semibold">Descuento</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PORCENTAJES.map((p) => (
                  <Boton
                    key={p}
                    onClick={() =>
                      ajustar({ tipo: "descuento", porcentaje: p }, `${p} % de descuento puesto`)
                    }
                  >
                    −{p} %
                  </Boton>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Otro porcentaje</span>
                  <input
                    className={claseEntrada}
                    inputMode="decimal"
                    placeholder="Otro %"
                    value={otroPorcentaje}
                    onChange={(e) => setOtroPorcentaje(e.target.value)}
                  />
                </label>
                <Boton
                  disabled={!(otro > 0 && otro <= 100)}
                  onClick={async () => {
                    if (
                      await ajustar(
                        { tipo: "descuento", porcentaje: otro },
                        `${otro} % de descuento puesto`,
                      )
                    )
                      setOtroPorcentaje("");
                  }}
                >
                  Aplicar
                </Boton>
              </div>
            </div>

            <div>
              <Campo
                etiqueta="Precio nuevo por unidad"
                ayuda={
                  unaSola
                    ? `En la carta: ${euros(precioConOpciones(unaSola))}. Ahora: ${euros(precioFinal(unaSola))}.`
                    : "Se pone a todos los marcados. Para subir o bajar el precio."
                }
              >
                <div className="flex gap-2">
                  <input
                    className={claseEntrada}
                    inputMode="decimal"
                    placeholder="Por ejemplo 3,50"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                  />
                  <Boton
                    variante="primario"
                    disabled={precioNuevo === null || precioNuevo < 0}
                    onClick={async () => {
                      if (
                        precioNuevo !== null &&
                        (await ajustar({ tipo: "precio", precio: precioNuevo }, "Precio cambiado"))
                      )
                        setPrecio("");
                    }}
                  >
                    Poner
                  </Boton>
                </div>
              </Campo>
            </div>

            <Boton
              variante="fantasma"
              onClick={() => ajustar({ tipo: "original" }, "Precio de la carta otra vez")}
            >
              <RotateCcw aria-hidden className="size-4" /> Volver al precio de la carta
            </Boton>
          </fieldset>
        </>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-semibold">Descuento en %</p>
            <div className="grid grid-cols-4 gap-2">
              {[0, ...PORCENTAJES.slice(0, 6), 100].map((d) => (
                <Boton
                  key={d}
                  variante={cuenta.descuento === d ? "primario" : "secundario"}
                  aria-pressed={cuenta.descuento === d}
                  onClick={() =>
                    descuentoCuenta(d, undefined, d ? `${d} % de descuento` : "Sin descuento en %")
                  }
                >
                  {d === 0 ? "Sin" : d === 100 ? "Invita la casa" : `${d} %`}
                </Boton>
              ))}
            </div>
          </div>

          <Campo etiqueta="Descuento en euros" ayuda="Se resta del total (después del %).">
            <div className="flex gap-2">
              <input
                className={claseEntrada}
                inputMode="decimal"
                placeholder="Por ejemplo 2"
                value={enEuros}
                onChange={(e) => setEnEuros(e.target.value)}
              />
              <Boton
                variante="primario"
                disabled={euroNuevo === null || euroNuevo <= 0}
                onClick={async () => {
                  if (
                    euroNuevo !== null &&
                    (await descuentoCuenta(
                      cuenta.descuento,
                      euroNuevo,
                      `${euros(euroNuevo)} de descuento`,
                    ))
                  )
                    setEnEuros("");
                }}
              >
                Restar
              </Boton>
            </div>
          </Campo>

          <Campo
            etiqueta="Cobrar justo"
            ayuda={`Lo que pagará en total. Ahora: ${euros(total)}${cuenta.descuentoImporte ? ` (con ${euros(cuenta.descuentoImporte)} menos)` : ""}.`}
          >
            <div className="flex gap-2">
              <input
                className={claseEntrada}
                inputMode="decimal"
                placeholder="Por ejemplo 20"
                value={cobrarJusto}
                onChange={(e) => setCobrarJusto(e.target.value)}
              />
              <Boton
                variante="primario"
                disabled={justo === null || justo < 0 || justo > conPorcentaje}
                onClick={async () => {
                  if (
                    justo !== null &&
                    (await descuentoCuenta(
                      cuenta.descuento,
                      conPorcentaje - justo,
                      `Se cobrarán ${euros(justo)}`,
                    ))
                  )
                    setCobrarJusto("");
                }}
              >
                Dejarlo así
              </Boton>
            </div>
          </Campo>

          {(cuenta.descuento > 0 || Boolean(cuenta.descuentoImporte)) && (
            <Boton variante="fantasma" onClick={() => descuentoCuenta(0, 0, "Descuentos quitados")}>
              <RotateCcw aria-hidden className="size-4" /> Quitar los descuentos de la cuenta
            </Boton>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-zinc pt-3">
        <p>
          <span className="text-sm text-tinta-suave">Total ahora </span>
          <span className="font-rotulo text-3xl font-bold">{euros(total)}</span>
        </p>
        <Boton variante="primario" onClick={alCerrar}>
          Hecho
        </Boton>
      </div>
    </>
  );
}
