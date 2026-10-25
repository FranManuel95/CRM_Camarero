"use client";

import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { formatearCantidad, leerCantidad } from "@/lib/dominio/stock";
import type { Ingrediente } from "@/lib/dominio/tipos";

export type Ajuste = { ingrediente: Ingrediente; tipo: "recuento" | "merma" };

/** Contar lo que hay de verdad, o apuntar lo que se ha tirado o roto. */
export function DialogoAjuste({
  ajuste,
  alCerrar,
}: {
  ajuste: Ajuste | null;
  alCerrar: () => void;
}) {
  return (
    <Dialogo
      abierto={ajuste !== null}
      alCerrar={alCerrar}
      titulo={
        ajuste
          ? ajuste.tipo === "recuento"
            ? `Contar ${ajuste.ingrediente.nombre}`
            : `Merma de ${ajuste.ingrediente.nombre}`
          : ""
      }
      ancho="max-w-md"
    >
      {ajuste && (
        <Formulario
          key={`${ajuste.ingrediente.id}-${ajuste.tipo}`}
          ajuste={ajuste}
          alCerrar={alCerrar}
        />
      )}
    </Dialogo>
  );
}

function Formulario({ ajuste, alCerrar }: { ajuste: Ajuste; alCerrar: () => void }) {
  const { hacer } = useDatos();
  const { ingrediente: i, tipo } = ajuste;
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const cantidad = leerCantidad(texto);
  const valido = cantidad !== null && cantidad >= 0 && (tipo === "recuento" || cantidad > 0);
  const quedara =
    cantidad === null ? null : tipo === "recuento" ? cantidad : i.existencias - cantidad;

  async function guardar() {
    if (!valido || cantidad === null) return;
    const ok = await hacer(
      { tipo: "ajustar_stock", ingredienteId: i.id, ajuste: tipo, cantidad, nota: nota.trim() },
      tipo === "recuento" ? "Recuento apuntado" : "Merma apuntada",
    );
    if (ok) alCerrar();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
      className="grid gap-3"
    >
      <p className="text-tinta-suave">
        Según la app quedan{" "}
        <span className="font-semibold text-tinta">
          {formatearCantidad(i.existencias, i.unidad)}
        </span>
        .
      </p>
      <Campo
        etiqueta={
          tipo === "recuento"
            ? `¿Cuánto hay ahora? (${i.unidad})`
            : `¿Cuánto se ha tirado? (${i.unidad})`
        }
      >
        <input
          autoFocus
          required
          inputMode="decimal"
          className={claseEntrada}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="0"
        />
      </Campo>
      <Campo etiqueta="Nota (opcional)">
        <input
          className={claseEntrada}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={tipo === "merma" ? "Se cayó una caja" : "Inventario del lunes"}
          maxLength={140}
        />
      </Campo>
      {quedara !== null && (
        <p className="text-sm text-tinta-suave" aria-live="polite">
          Quedarán {formatearCantidad(quedara, i.unidad)}.
        </p>
      )}
      <Boton type="submit" variante="primario" disabled={!valido}>
        {tipo === "recuento" ? "Guardar recuento" : "Apuntar merma"}
      </Boton>
    </form>
  );
}
