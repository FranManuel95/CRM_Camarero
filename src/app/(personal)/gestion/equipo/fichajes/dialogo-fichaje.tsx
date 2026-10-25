"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { horaDe, instante } from "@/lib/dominio/equipo";
import { sumarDias } from "@/lib/dominio/informes";
import type { Fichaje } from "@/lib/dominio/tipos";
import { diaLocal } from "@/lib/fechas";

/** Corregir un fichaje (o apuntar uno a mano si `fichaje` es null). */
export type Correccion = { fichaje: Fichaje | null };

type Borrador = {
  empleadoId: string;
  dia: string;
  entrada: string;
  salida: string;
  pausas: { inicio: string; fin: string }[];
  motivo: string;
};

function borradorDe(f: Fichaje | null, empleadoId: string): Borrador {
  if (!f)
    return {
      empleadoId,
      dia: diaLocal(new Date().toISOString()),
      entrada: "",
      salida: "",
      pausas: [],
      motivo: "",
    };
  return {
    empleadoId: f.empleadoId,
    dia: diaLocal(f.entrada),
    entrada: horaDe(f.entrada),
    salida: f.salida ? horaDe(f.salida) : "",
    pausas: f.pausas.map((p) => ({ inicio: horaDe(p.inicio), fin: p.fin ? horaDe(p.fin) : "" })),
    motivo: "",
  };
}

export function DialogoFichaje({
  correccion,
  alCerrar,
}: {
  correccion: Correccion | null;
  alCerrar: () => void;
}) {
  return (
    <Dialogo
      abierto={correccion !== null}
      alCerrar={alCerrar}
      titulo={correccion?.fichaje ? "Corregir fichaje" : "Apuntar un fichaje a mano"}
    >
      {correccion && (
        <Formulario
          key={correccion.fichaje?.id ?? "nuevo"}
          fichaje={correccion.fichaje}
          alCerrar={alCerrar}
        />
      )}
    </Dialogo>
  );
}

function Formulario({ fichaje, alCerrar }: { fichaje: Fichaje | null; alCerrar: () => void }) {
  const { estado, hacer } = useDatos();
  const [b, setB] = useState(() => borradorDe(fichaje, estado.empleados[0]?.id ?? ""));

  // Una hora menor que la de entrada es del día siguiente (turnos que acaban de madrugada).
  const aIso = (hora: string) => instante(hora < b.entrada ? sumarDias(b.dia, 1) : b.dia, hora);
  const valido =
    b.empleadoId &&
    b.dia &&
    b.entrada &&
    b.motivo.trim().length >= 3 &&
    b.pausas.every((p) => p.inicio && (p.fin || !b.salida));

  async function guardar() {
    if (!valido) return;
    const ok = await hacer(
      {
        tipo: "corregir_fichaje",
        ...(fichaje ? { fichajeId: fichaje.id } : {}),
        empleadoId: b.empleadoId,
        entrada: instante(b.dia, b.entrada),
        salida: b.salida ? aIso(b.salida) : null,
        pausas: b.pausas.map((p) => ({ inicio: aIso(p.inicio), fin: p.fin ? aIso(p.fin) : null })),
        motivo: b.motivo.trim(),
      },
      fichaje ? "Fichaje corregido" : "Fichaje apuntado",
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
      <Campo etiqueta="Persona">
        <select
          className={claseEntrada}
          value={b.empleadoId}
          disabled={Boolean(fichaje)}
          onChange={(e) => setB({ ...b, empleadoId: e.target.value })}
        >
          {estado.empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Día">
        <input
          type="date"
          required
          className={claseEntrada}
          value={b.dia}
          onChange={(e) => setB({ ...b, dia: e.target.value })}
        />
      </Campo>
      <Campo etiqueta="Entrada">
        <input
          type="time"
          required
          className={claseEntrada}
          value={b.entrada}
          onChange={(e) => setB({ ...b, entrada: e.target.value })}
        />
      </Campo>
      <Campo
        etiqueta="Salida"
        ayuda={
          !b.salida
            ? "Vacío si sigue trabajando."
            : b.salida < b.entrada
              ? "Del día siguiente."
              : undefined
        }
      >
        <input
          type="time"
          className={claseEntrada}
          value={b.salida}
          onChange={(e) => setB({ ...b, salida: e.target.value })}
        />
      </Campo>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-sm font-semibold">Descansos</legend>
        <ul className="grid gap-2">
          {b.pausas.map((p, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                type="time"
                aria-label={`Inicio del descanso ${i + 1}`}
                className={claseEntrada}
                value={p.inicio}
                onChange={(e) =>
                  setB({
                    ...b,
                    pausas: b.pausas.map((x, j) =>
                      j === i ? { ...x, inicio: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                type="time"
                aria-label={`Fin del descanso ${i + 1}`}
                className={claseEntrada}
                value={p.fin}
                onChange={(e) =>
                  setB({
                    ...b,
                    pausas: b.pausas.map((x, j) => (j === i ? { ...x, fin: e.target.value } : x)),
                  })
                }
              />
              <Boton
                variante="fantasma"
                aria-label={`Quitar el descanso ${i + 1}`}
                onClick={() => setB({ ...b, pausas: b.pausas.filter((_, j) => j !== i) })}
              >
                <Trash2 aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
        <Boton
          tamano="pequeno"
          className="mt-2"
          onClick={() => setB({ ...b, pausas: [...b.pausas, { inicio: "", fin: "" }] })}
        >
          <Plus aria-hidden className="size-4" /> Añadir descanso
        </Boton>
      </fieldset>

      <Campo
        etiqueta="Motivo"
        ayuda="Queda apuntado junto con lo que había antes y quién lo ha cambiado."
        className="sm:col-span-2"
      >
        <input
          required
          className={claseEntrada}
          value={b.motivo}
          maxLength={200}
          onChange={(e) => setB({ ...b, motivo: e.target.value })}
          placeholder="Se le olvidó fichar la salida"
        />
      </Campo>
      <Boton type="submit" variante="primario" className="sm:col-span-2" disabled={!valido}>
        {fichaje ? "Guardar la corrección" : "Apuntar el fichaje"}
      </Boton>
    </form>
  );
}
