"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { euros, importeLinea } from "@/lib/dominio/importes";
import type { Cuenta, LineaCuenta } from "@/lib/dominio/tipos";

const MOTIVOS = ["Error al pedir", "El cliente lo cancela", "Se ha caído", "Tarda demasiado"];

/** Lo que se puede anular de una cuenta: lo que no está anulado, cobrado ni por aceptar. */
export function anulables(cuenta: Cuenta): LineaCuenta[] {
  return cuenta.lineas.filter(
    (l) => l.estado !== "anulada" && l.estado !== "por_confirmar" && !l.ticketId,
  );
}

/**
 * Anular una, varias o todas las líneas de una cuenta, y de cada una cuántas unidades. El motivo
 * es opcional: queda apuntado quién lo anula igualmente.
 */
export function AnularLineas({
  cuenta,
  inicial,
  alCerrar,
}: {
  cuenta: Cuenta;
  /** La línea desde la que se ha pulsado «Anular»: sale ya marcada. */
  inicial: LineaCuenta;
  alCerrar: () => void;
}) {
  const { hacer } = useDatos();
  const lineas = anulables(cuenta);
  // Por línea marcada, cuántas unidades se anulan.
  const [marcadas, setMarcadas] = useState<Record<string, number>>({
    [inicial.id]: inicial.cantidad,
  });
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const elegidas = lineas.filter((l) => marcadas[l.id]);
  const todas = elegidas.length === lineas.length;
  const unidades = elegidas.reduce((n, l) => n + marcadas[l.id]!, 0);
  const importe = elegidas.reduce(
    (n, l) => n + importeLinea({ ...l, cantidad: marcadas[l.id]! }),
    0,
  );

  function marcar(l: LineaCuenta, si: boolean) {
    setMarcadas((m) => {
      const nuevas = { ...m };
      if (si) nuevas[l.id] = l.cantidad;
      else delete nuevas[l.id];
      return nuevas;
    });
  }

  async function anular() {
    setEnviando(true);
    const ok = await hacer(
      {
        tipo: "anular_lineas",
        cuentaId: cuenta.id,
        lineas: elegidas.map((l) => ({
          lineaId: l.id,
          ...(marcadas[l.id]! < l.cantidad ? { cantidad: marcadas[l.id]! } : {}),
        })),
        motivo: motivo.trim(),
      },
      unidades === 1 ? "Anulado" : `${unidades} anulados`,
    );
    setEnviando(false);
    if (ok) alCerrar();
  }

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo="Anular">
      <p className="mb-3 text-sm text-tinta-suave">
        Marca lo que se anula. Lo que ya está en cocina o barra queda apuntado con quién lo anula.
      </p>
      {lineas.length > 1 && (
        <Boton
          tamano="pequeno"
          variante={todas ? "primario" : "secundario"}
          aria-pressed={todas}
          className="mb-2"
          onClick={() =>
            setMarcadas(todas ? {} : Object.fromEntries(lineas.map((l) => [l.id, l.cantidad])))
          }
        >
          {todas ? "Quitar todo" : "Todo"}
        </Boton>
      )}
      <ul className="mb-4 max-h-72 divide-y divide-zinc overflow-y-auto rounded-xl ring-1 ring-zinc">
        {lineas.map((l) => {
          const cuantas = marcadas[l.id];
          return (
            <li key={l.id} className={clsx("px-3 py-2", cuantas && "bg-aviso-claro")}>
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-aviso"
                    checked={Boolean(cuantas)}
                    onChange={(e) => marcar(l, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {l.cantidad}× {l.nombre}
                  </span>
                </label>
                <span className="shrink-0 text-sm text-tinta-suave tabular-nums">
                  {euros(importeLinea(l))}
                </span>
              </div>
              {cuantas && l.cantidad > 1 ? (
                <div className="mt-2 ml-8 flex items-center gap-2">
                  <Boton
                    tamano="pequeno"
                    aria-label={`Una ${l.nombre} menos para anular`}
                    disabled={cuantas <= 1}
                    onClick={() => setMarcadas((m) => ({ ...m, [l.id]: cuantas - 1 }))}
                  >
                    <Minus aria-hidden className="size-4" />
                  </Boton>
                  <span className="min-w-20 text-center text-sm font-semibold" aria-live="polite">
                    {cuantas} de {l.cantidad}
                  </span>
                  <Boton
                    tamano="pequeno"
                    aria-label={`Una ${l.nombre} más para anular`}
                    disabled={cuantas >= l.cantidad}
                    onClick={() => setMarcadas((m) => ({ ...m, [l.id]: cuantas + 1 }))}
                  >
                    <Plus aria-hidden className="size-4" />
                  </Boton>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mb-3 flex flex-wrap gap-2">
        {MOTIVOS.map((m) => (
          <Boton
            key={m}
            tamano="pequeno"
            variante={motivo === m ? "primario" : "secundario"}
            aria-pressed={motivo === m}
            onClick={() => setMotivo(motivo === m ? "" : m)}
          >
            {m}
          </Boton>
        ))}
      </div>
      <Campo etiqueta="Motivo (opcional)" className="mb-4">
        <input
          className={claseEntrada}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={140}
        />
      </Campo>
      <div className="flex justify-end">
        <Boton variante="peligro" disabled={!unidades || enviando} onClick={anular}>
          {unidades ? `Anular ${unidades} · ${euros(importe)}` : "Anular"}
        </Boton>
      </div>
    </Dialogo>
  );
}
