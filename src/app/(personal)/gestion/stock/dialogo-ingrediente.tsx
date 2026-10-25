"use client";

import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { leerEuros } from "@/lib/dominio/importes";
import { leerCantidad } from "@/lib/dominio/stock";
import { type Ingrediente, NOMBRE_UNIDAD, type Unidad } from "@/lib/dominio/tipos";

type Borrador = {
  nombre: string;
  unidad: Unidad;
  existencias: string;
  minimo: string;
  pedirHasta: string;
  coste: string;
  proveedor: string;
};

const aTexto = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));
const aEuros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function borradorDe(i: Ingrediente | null): Borrador {
  return i
    ? {
        nombre: i.nombre,
        unidad: i.unidad,
        existencias: aTexto(i.existencias),
        minimo: aTexto(i.minimo),
        pedirHasta: aTexto(i.pedirHasta),
        coste: aEuros(i.coste),
        proveedor: i.proveedor,
      }
    : {
        nombre: "",
        unidad: "kg",
        existencias: "",
        minimo: "",
        pedirHasta: "",
        coste: "",
        proveedor: "",
      };
}

/** Alta y edición de un ingrediente. Las existencias solo se ponen al darlo de alta. */
export function DialogoIngrediente({
  ingrediente,
  abierto,
  alCerrar,
}: {
  ingrediente: Ingrediente | null;
  abierto: boolean;
  alCerrar: () => void;
}) {
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={ingrediente ? `Editar ${ingrediente.nombre}` : "Nuevo ingrediente"}
    >
      {abierto && (
        <Formulario
          key={ingrediente?.id ?? "nuevo"}
          ingrediente={ingrediente}
          alCerrar={alCerrar}
        />
      )}
    </Dialogo>
  );
}

function Formulario({
  ingrediente,
  alCerrar,
}: {
  ingrediente: Ingrediente | null;
  alCerrar: () => void;
}) {
  const { estado, hacer } = useDatos();
  const [b, setB] = useState(() => borradorDe(ingrediente));
  const proveedores = [
    ...new Set(
      [...estado.ingredientes.map((i) => i.proveedor), ...estado.gastos.map((g) => g.proveedor)]
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ].sort();

  const minimo = leerCantidad(b.minimo || "0");
  const existencias = leerCantidad(b.existencias || "0");
  const pedirHasta = b.pedirHasta ? leerCantidad(b.pedirHasta) : undefined;
  const coste = b.coste ? leerEuros(b.coste) : 0;
  const valido =
    b.nombre.trim() &&
    minimo !== null &&
    minimo >= 0 &&
    existencias !== null &&
    existencias >= 0 &&
    pedirHasta !== null &&
    coste !== null;
  const unidad = NOMBRE_UNIDAD[b.unidad];

  async function guardar() {
    if (!valido) return;
    const ok = await hacer(
      {
        tipo: "guardar_ingrediente",
        ingrediente: {
          ...(ingrediente ? { id: ingrediente.id } : { existencias: existencias ?? 0 }),
          nombre: b.nombre.trim(),
          unidad: b.unidad,
          minimo: minimo ?? 0,
          ...(pedirHasta ? { pedirHasta } : {}),
          coste: coste ?? 0,
          proveedor: b.proveedor.trim(),
        },
      },
      "Ingrediente guardado",
    );
    if (ok) alCerrar();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Campo etiqueta="Nombre" className="sm:col-span-2">
        <input
          required
          className={claseEntrada}
          value={b.nombre}
          onChange={(e) => setB({ ...b, nombre: e.target.value })}
          placeholder="Patatas"
        />
      </Campo>
      <Campo etiqueta="Se cuenta en">
        <select
          className={claseEntrada}
          value={b.unidad}
          onChange={(e) => setB({ ...b, unidad: e.target.value as Unidad })}
        >
          {Object.entries(NOMBRE_UNIDAD).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta={`Precio por ${b.unidad === "ud" ? "unidad" : b.unidad} (con IVA)`}>
        <input
          inputMode="decimal"
          className={claseEntrada}
          value={b.coste}
          onChange={(e) => setB({ ...b, coste: e.target.value })}
          placeholder="0,00"
        />
      </Campo>
      {!ingrediente && (
        <Campo
          etiqueta={`Lo que hay ahora (${unidad})`}
          ayuda="Luego cambia solo al vender y comprar."
        >
          <input
            inputMode="decimal"
            className={claseEntrada}
            value={b.existencias}
            onChange={(e) => setB({ ...b, existencias: e.target.value })}
            placeholder="0"
          />
        </Campo>
      )}
      <Campo etiqueta={`Mínimo (${unidad})`} ayuda="Por debajo, avisa y lo pone en la compra.">
        <input
          inputMode="decimal"
          className={claseEntrada}
          value={b.minimo}
          onChange={(e) => setB({ ...b, minimo: e.target.value })}
          placeholder="0"
        />
      </Campo>
      <Campo
        etiqueta={`Pedir hasta (${unidad})`}
        ayuda="Lo que quieres tener tras la compra. Si lo dejas vacío, el doble del mínimo."
      >
        <input
          inputMode="decimal"
          className={claseEntrada}
          value={b.pedirHasta}
          onChange={(e) => setB({ ...b, pedirHasta: e.target.value })}
        />
      </Campo>
      <Campo etiqueta="Proveedor">
        <input
          className={claseEntrada}
          list="proveedores-stock"
          value={b.proveedor}
          onChange={(e) => setB({ ...b, proveedor: e.target.value })}
        />
        <datalist id="proveedores-stock">
          {proveedores.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Campo>
      <Boton type="submit" variante="primario" className="sm:col-span-2" disabled={!valido}>
        Guardar ingrediente
      </Boton>
    </form>
  );
}
