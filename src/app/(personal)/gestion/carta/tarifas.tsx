"use client";

import clsx from "clsx";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor } from "@/components/ui";
import { describirHorario, NOMBRE_DIA } from "@/lib/dominio/horario";
import { textoPorcentaje } from "@/lib/dominio/tarifas";
import type { Tarifa } from "@/lib/dominio/tipos";

/** Lunes primero, como en un calendario de aquí. */
const DIAS = [1, 2, 3, 4, 5, 6, 0];

/**
 * Precios por horario y zona: happy hour en las cervezas de 18 a 20 h, la terraza un 10 % más…
 * El precio cambia solo al anotar; en la carta del QR se ve el de ese momento.
 */
export function Tarifas() {
  const { estado, hacer } = useDatos();
  const activa = useFuncion("tarifas");
  const tarifas = estado.ajustes.tarifas ?? [];
  const [borrador, setBorrador] = useState<Tarifa | null>(null);
  if (!activa) return null;

  const guardarLista = (lista: Tarifa[], mensaje: string) =>
    hacer({ tipo: "guardar_tarifas", tarifas: lista }, mensaje);

  const nombreDe = (ids: string[], de: { id: string; nombre: string }[], todas: string) =>
    ids.length ? ids.map((id) => de.find((x) => x.id === id)?.nombre ?? "—").join(", ") : todas;

  return (
    <section className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-tarifas">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="t-tarifas" className="mr-auto font-rotulo text-2xl font-bold">
          Precios por horario y zona
        </h2>
        <Boton
          onClick={() =>
            setBorrador({
              id: crypto.randomUUID(),
              nombre: "Happy hour",
              porcentaje: -20,
              horario: { desde: "18:00", hasta: "20:00", dias: [] },
              categoriaIds: [],
              zonaIds: [],
              activa: true,
            })
          }
        >
          <Plus aria-hidden className="size-4" /> Añadir
        </Boton>
      </div>
      <p className="mb-3 text-sm text-tinta-suave">
        Happy hour, terraza más cara, desayunos más baratos… El precio cambia solo al anotar, y en
        la carta del QR sale el de ese momento.
      </p>
      {tarifas.length === 0 ? (
        <p className="text-sm text-tinta-suave">Ninguno todavía.</p>
      ) : (
        <ul className="divide-y divide-zinc">
          {tarifas.map((t) => (
            <li
              key={t.id}
              className={clsx("flex flex-wrap items-center gap-2 py-2", !t.activa && "opacity-50")}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {t.nombre}{" "}
                  <span className={t.porcentaje < 0 ? "text-cuenta" : "text-aviso"}>
                    {textoPorcentaje(t.porcentaje)}
                  </span>
                  {!t.activa && " · apagado"}
                </p>
                <p className="text-sm text-tinta-suave">
                  <Clock aria-hidden className="mr-1 inline size-3.5" />
                  {t.horario ? describirHorario(t.horario) : "Siempre"} ·{" "}
                  {nombreDe(t.categoriaIds, estado.categorias, "toda la carta")} ·{" "}
                  {nombreDe(t.zonaIds, estado.zonas, "todas las zonas")}
                </p>
              </div>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Cambiar ${t.nombre}`}
                onClick={() => setBorrador(t)}
              >
                <Pencil aria-hidden className="size-4" />
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Quitar ${t.nombre}`}
                onClick={() =>
                  guardarLista(
                    tarifas.filter((x) => x.id !== t.id),
                    `${t.nombre} quitado`,
                  )
                }
              >
                <Trash2 aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={
          tarifas.some((t) => t.id === borrador?.id)
            ? "Cambiar precio especial"
            : "Nuevo precio especial"
        }
        ancho="max-w-2xl"
      >
        {borrador && (
          <Formulario
            inicial={borrador}
            alCancelar={() => setBorrador(null)}
            alGuardar={async (t) => {
              const lista = tarifas.some((x) => x.id === t.id)
                ? tarifas.map((x) => (x.id === t.id ? t : x))
                : [...tarifas, t];
              if (await guardarLista(lista, `${t.nombre} guardado`)) setBorrador(null);
            }}
          />
        )}
      </Dialogo>
    </section>
  );
}

function Formulario({
  inicial,
  alCancelar,
  alGuardar,
}: {
  inicial: Tarifa;
  alCancelar: () => void;
  alGuardar: (t: Tarifa) => Promise<void>;
}) {
  const { estado } = useDatos();
  const [t, setT] = useState(inicial);
  const [signo, setSigno] = useState<"descuento" | "recargo">(
    inicial.porcentaje < 0 ? "descuento" : "recargo",
  );
  const [cuanto, setCuanto] = useState(String(Math.abs(inicial.porcentaje)));
  const valor = Number(cuanto.replace(",", "."));
  const valido = t.nombre.trim() && valor > 0 && valor <= (signo === "descuento" ? 100 : 200);
  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
  const chip = (activo: boolean) =>
    clsx(
      "h-9 rounded-full px-3 text-sm font-semibold ring-1",
      activo ? "bg-cobalto text-white ring-cobalto" : "ring-zinc-oscuro",
    );

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido)
          void alGuardar({
            ...t,
            nombre: t.nombre.trim(),
            porcentaje: signo === "descuento" ? -valor : valor,
          });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_8rem]">
        <Campo etiqueta="Nombre">
          <input
            className={claseEntrada}
            value={t.nombre}
            maxLength={40}
            onChange={(e) => setT({ ...t, nombre: e.target.value })}
            required
          />
        </Campo>
        <Campo etiqueta="Tipo">
          <select
            className={claseEntrada}
            value={signo}
            onChange={(e) => setSigno(e.target.value as typeof signo)}
          >
            <option value="descuento">Más barato</option>
            <option value="recargo">Más caro</option>
          </select>
        </Campo>
        <Campo etiqueta="Porcentaje">
          <input
            className={claseEntrada}
            inputMode="decimal"
            value={cuanto}
            onChange={(e) => setCuanto(e.target.value)}
            required
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">Cuándo</legend>
        <Interruptor
          activo={Boolean(t.horario)}
          alCambiar={(v) =>
            setT({ ...t, horario: v ? { desde: "18:00", hasta: "20:00", dias: [] } : undefined })
          }
          etiqueta="Solo a unas horas"
          ayuda="Si no, siempre (por ejemplo, el recargo de la terraza)."
        />
        {t.horario && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <Campo etiqueta="Desde">
                <input
                  type="time"
                  className={claseEntrada}
                  value={t.horario.desde}
                  onChange={(e) =>
                    setT({ ...t, horario: { ...t.horario!, desde: e.target.value } })
                  }
                  required
                />
              </Campo>
              <Campo etiqueta="Hasta">
                <input
                  type="time"
                  className={claseEntrada}
                  value={t.horario.hasta}
                  onChange={(e) =>
                    setT({ ...t, horario: { ...t.horario!, hasta: e.target.value } })
                  }
                  required
                />
              </Campo>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días (ninguno: todos)">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={t.horario!.dias.includes(d)}
                  className={chip(t.horario!.dias.includes(d))}
                  onClick={() =>
                    setT({
                      ...t,
                      horario: {
                        ...t.horario!,
                        dias: alternar(t.horario!.dias.map(String), String(d)).map(Number),
                      },
                    })
                  }
                >
                  {NOMBRE_DIA[d]!.slice(0, 3)}
                </button>
              ))}
              <span className="self-center text-xs text-tinta-suave">
                Ninguno marcado: todos los días.
              </span>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">Qué (ninguna marcada: toda la carta)</legend>
        <div className="flex flex-wrap gap-1.5">
          {estado.categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={t.categoriaIds.includes(c.id)}
              className={chip(t.categoriaIds.includes(c.id))}
              onClick={() => setT({ ...t, categoriaIds: alternar(t.categoriaIds, c.id) })}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">Dónde (ninguna marcada: todas las zonas)</legend>
        <div className="flex flex-wrap gap-1.5">
          {estado.zonas.map((z) => (
            <button
              key={z.id}
              type="button"
              aria-pressed={t.zonaIds.includes(z.id)}
              className={chip(t.zonaIds.includes(z.id))}
              onClick={() => setT({ ...t, zonaIds: alternar(t.zonaIds, z.id) })}
            >
              {z.nombre}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          La venta rápida y lo de llevar no tienen zona: solo les toca lo que vale para todas.
        </p>
      </fieldset>

      <Interruptor
        activo={t.activa}
        alCambiar={(v) => setT({ ...t, activa: v })}
        etiqueta="Encendido"
      />

      <div className="flex justify-end gap-2">
        <Boton onClick={alCancelar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" disabled={!valido}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}
