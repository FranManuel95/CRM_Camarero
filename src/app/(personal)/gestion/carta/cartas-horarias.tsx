"use client";

import clsx from "clsx";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { cartasAhora } from "@/lib/dominio/cartas";
import { describirHorario, NOMBRE_DIA } from "@/lib/dominio/horario";
import type { CartaHoraria } from "@/lib/dominio/tipos";
import { useAhora } from "@/lib/cliente/use-ahora";

/** Lunes primero, como en un calendario de aquí. */
const DIAS = [1, 2, 3, 4, 5, 6, 0];

type Borrador = Omit<CartaHoraria, "id"> & { id?: string };

/** Para empezar con un toque. */
const MODELOS: Borrador[] = [
  {
    nombre: "Desayunos",
    nombreEn: "Breakfast",
    horario: { desde: "07:00", hasta: "12:30", dias: [] },
    categoriaIds: [],
  },
  {
    nombre: "Mediodía",
    nombreEn: "Lunch",
    horario: { desde: "12:30", hasta: "17:00", dias: [] },
    categoriaIds: [],
  },
  {
    nombre: "Cenas",
    nombreEn: "Dinner",
    horario: { desde: "20:00", hasta: "00:00", dias: [] },
    categoriaIds: [],
  },
];

/**
 * Cartas por horario: desayunos, mediodía, cenas… En el QR el cliente solo ve la que toca; el
 * camarero la ve primero, pero puede abrir otra o toda la carta. Lo que no está en ninguna carta
 * (bebidas, por ejemplo) sale siempre.
 */
export function CartasHorarias() {
  const { estado, hacer } = useDatos();
  const ingles = useFuncion("cartaIngles");
  const ahora = useAhora(60_000);
  const cartas = estado.cartas ?? [];
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const activas = new Set(cartasAhora(estado, ahora).map((c) => c.id));
  const enAlguna = new Set(cartas.flatMap((c) => c.categoriaIds));
  const siempre = estado.categorias.filter((c) => !enAlguna.has(c.id));
  const nombres = (ids: string[]) =>
    ids.map((id) => estado.categorias.find((c) => c.id === id)?.nombre ?? "—").join(", ");

  return (
    <section className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-cartas">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="t-cartas" className="mr-auto font-rotulo text-2xl font-bold">
          Cartas por horario
        </h2>
        <Boton
          onClick={() =>
            setBorrador({
              nombre: "",
              horario: { desde: "08:00", hasta: "12:00", dias: [] },
              categoriaIds: [],
            })
          }
        >
          <Plus aria-hidden className="size-4" /> Añadir
        </Boton>
      </div>
      <p className="mb-3 text-sm text-tinta-suave">
        Desayunos, mediodía, cenas… Cada carta tiene su horario y sus categorías. En el QR el
        cliente solo ve la que toca; el camarero la ve primero y puede abrir las demás. Lo que no
        esté en ninguna carta (las bebidas, por ejemplo) sale siempre.
      </p>

      {cartas.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-tinta-suave">Empieza por:</span>
          {MODELOS.map((m) => (
            <Boton key={m.nombre} tamano="pequeno" onClick={() => setBorrador(m)}>
              {m.nombre} ({m.horario.desde}–{m.horario.hasta})
            </Boton>
          ))}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-zinc">
            {cartas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.nombre}
                    {activas.has(c.id) && (
                      <span className="ml-2 rounded-full bg-cuenta-claro px-2 py-0.5 text-xs">
                        Ahora
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    <Clock aria-hidden className="mr-1 inline size-3.5" />
                    {describirHorario(c.horario)} · {nombres(c.categoriaIds) || "sin categorías"}
                  </p>
                </div>
                <Boton
                  tamano="pequeno"
                  variante="fantasma"
                  aria-label={`Cambiar ${c.nombre}`}
                  onClick={() => setBorrador(c)}
                >
                  <Pencil aria-hidden className="size-4" />
                </Boton>
                <Boton
                  tamano="pequeno"
                  variante="fantasma"
                  aria-label={`Quitar ${c.nombre}`}
                  onClick={() => {
                    if (confirm(`¿Quitar la carta «${c.nombre}»? Sus categorías saldrán siempre.`))
                      void hacer(
                        { tipo: "borrar_carta_horaria", cartaId: c.id },
                        `${c.nombre} quitada`,
                      );
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Boton>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-tinta-suave">
            Siempre: {siempre.length ? siempre.map((c) => c.nombre).join(", ") : "nada"}.
          </p>
        </>
      )}

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? "Cambiar carta" : "Nueva carta"}
        ancho="max-w-2xl"
      >
        {borrador && (
          <Formulario
            key={borrador.id ?? borrador.nombre}
            inicial={borrador}
            ingles={ingles}
            alCancelar={() => setBorrador(null)}
            alGuardar={async (carta) => {
              if (await hacer({ tipo: "guardar_carta_horaria", carta }, `${carta.nombre} guardada`))
                setBorrador(null);
            }}
          />
        )}
      </Dialogo>
    </section>
  );
}

function Formulario({
  inicial,
  ingles,
  alCancelar,
  alGuardar,
}: {
  inicial: Borrador;
  ingles: boolean;
  alCancelar: () => void;
  alGuardar: (c: Borrador) => Promise<void>;
}) {
  const { estado } = useDatos();
  const [c, setC] = useState(inicial);
  const alternar = <T,>(lista: T[], x: T) =>
    lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x];
  const chip = (activo: boolean) =>
    clsx(
      "h-9 rounded-full px-3 text-sm font-semibold ring-1",
      activo ? "bg-cobalto text-white ring-cobalto" : "ring-zinc-oscuro",
    );
  const categorias = [...estado.categorias].sort((a, b) => a.orden - b.orden);
  const valida = c.nombre.trim() && c.categoriaIds.length > 0;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valida) return;
        const { nombreEn, ...resto } = c;
        void alGuardar({
          ...resto,
          nombre: c.nombre.trim(),
          ...(ingles && nombreEn?.trim() ? { nombreEn: nombreEn.trim() } : {}),
        });
      }}
    >
      <div className={clsx("grid gap-3", ingles && "sm:grid-cols-2")}>
        <Campo
          etiqueta="Nombre"
          ayuda="Lo ven el cliente y el camarero: «Desayunos», «Menú de noche»…"
        >
          <input
            className={claseEntrada}
            value={c.nombre}
            maxLength={40}
            onChange={(e) => setC({ ...c, nombre: e.target.value })}
            required
          />
        </Campo>
        {ingles && (
          <Campo etiqueta="Nombre en inglés (opcional)">
            <input
              className={claseEntrada}
              value={c.nombreEn ?? ""}
              maxLength={40}
              onChange={(e) => setC({ ...c, nombreEn: e.target.value })}
            />
          </Campo>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">Horario</legend>
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Campo etiqueta="Desde">
            <input
              type="time"
              className={claseEntrada}
              value={c.horario.desde}
              onChange={(e) => setC({ ...c, horario: { ...c.horario, desde: e.target.value } })}
              required
            />
          </Campo>
          <Campo etiqueta="Hasta">
            <input
              type="time"
              className={claseEntrada}
              value={c.horario.hasta}
              onChange={(e) => setC({ ...c, horario: { ...c.horario, hasta: e.target.value } })}
              required
            />
          </Campo>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Días (ninguno: todos)"
        >
          {DIAS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={c.horario.dias.includes(d)}
              className={chip(c.horario.dias.includes(d))}
              onClick={() =>
                setC({ ...c, horario: { ...c.horario, dias: alternar(c.horario.dias, d) } })
              }
            >
              {NOMBRE_DIA[d]!.slice(0, 3)}
            </button>
          ))}
          <span className="self-center text-xs text-tinta-suave">
            Ninguno marcado: todos los días.
          </span>
        </div>
        <p className="mt-2 text-sm text-tinta-suave">{describirHorario(c.horario)}</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">Qué categorías lleva</legend>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={c.categoriaIds.includes(cat.id)}
              className={chip(c.categoriaIds.includes(cat.id))}
              onClick={() => setC({ ...c, categoriaIds: alternar(c.categoriaIds, cat.id) })}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          Una categoría puede estar en varias cartas (los cafés, en desayunos y cenas).
        </p>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Boton onClick={alCancelar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" disabled={!valida}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}
