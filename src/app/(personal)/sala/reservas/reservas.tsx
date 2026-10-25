"use client";

import clsx from "clsx";
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Plus, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { SiFuncion } from "@/components/funcion-apagada";
import { Boton, Campo, claseEntrada, Dialogo, Vacio } from "@/components/ui";
import { sumarDias } from "@/lib/dominio/informes";
import { pendiente, reservasDelDia } from "@/lib/dominio/reservas";
import { situacionMesa } from "@/lib/dominio/selectores";
import type { EstadoReserva, Reserva } from "@/lib/dominio/tipos";
import { conMayuscula, diaLocal } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";

const TEXTO_ESTADO: Record<EstadoReserva, string> = {
  por_confirmar: "Por confirmar",
  confirmada: "Confirmada",
  sentada: "Sentada",
  cancelada: "Cancelada",
  no_vino: "No vino",
};

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  por_confirmar: "bg-aviso-claro ring-aviso",
  confirmada: "bg-white ring-zinc-oscuro",
  sentada: "bg-cuenta-claro ring-cuenta",
  cancelada: "bg-zinc-claro ring-zinc opacity-70",
  no_vino: "bg-zinc-claro ring-zinc opacity-70",
};

const nombreDia = (dia: string) =>
  conMayuscula(
    new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${dia}T12:00:00Z`)),
  );

type Borrador = Omit<Reserva, "estado" | "online" | "creadaEn" | "id"> & { id?: string };

export function Reservas() {
  return (
    <SiFuncion funcion="reservas">
      <LibroReservas />
    </SiFuncion>
  );
}

function LibroReservas() {
  const { estado, hacer } = useDatos();
  const ahora = useAhora();
  const hoy = diaLocal(ahora);
  const [dia, setDia] = useState(hoy);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [sentando, setSentando] = useState<Reserva | null>(null);
  const delDia = reservasDelDia(estado.reservas, dia);
  const personas = delDia.filter(pendiente).reduce((s, r) => s + r.personas, 0);
  // Las del día que se está viendo ya salen abajo.
  const porConfirmar = estado.reservas
    .filter((r) => r.estado === "por_confirmar" && r.dia >= hoy && r.dia !== dia)
    .sort((a, b) => (a.dia + a.hora).localeCompare(b.dia + b.hora));
  const nombreMesa = (id: string | null) => estado.mesas.find((m) => m.id === id)?.nombre;

  const nueva = (): Borrador => ({
    nombre: "",
    telefono: "",
    personas: 2,
    dia,
    hora: "21:00",
    mesaId: null,
    nota: "",
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    if (
      await hacer(
        { tipo: "guardar_reserva", reserva: borrador },
        borrador.id ? "Reserva cambiada" : "Reserva apuntada",
      )
    )
      setBorrador(null);
  }

  return (
    <main className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/sala" className="rounded-lg p-2 hover:bg-zinc" aria-label="Volver a la sala">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="mr-auto font-rotulo text-4xl font-bold">Reservas</h1>
        <Boton variante="primario" onClick={() => setBorrador(nueva())}>
          <Plus aria-hidden className="size-4" /> Nueva reserva
        </Boton>
      </div>

      {porConfirmar.length > 0 && (
        <section
          aria-labelledby="titulo-confirmar"
          className="mb-5 rounded-2xl bg-aviso-claro p-4 ring-2 ring-aviso"
        >
          <h2 id="titulo-confirmar" className="mb-2 font-rotulo text-2xl font-bold">
            Pedidas desde la web
          </h2>
          <p className="mb-3 text-sm">
            Llama para confirmar y ponles mesa. Hasta entonces no cuentan como confirmadas.
          </p>
          <ul className="space-y-2">
            {porConfirmar.map((r) => (
              <FilaReserva
                key={r.id}
                reserva={r}
                conDia
                mesa={nombreMesa(r.mesaId)}
                alEditar={() => setBorrador(r)}
                alSentar={() => setSentando(r)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Boton aria-label="Día anterior" onClick={() => setDia(sumarDias(dia, -1))}>
          <ChevronLeft aria-hidden className="size-5" />
        </Boton>
        <h2 className="flex-1 text-center font-rotulo text-2xl font-bold" aria-live="polite">
          {dia === hoy ? "Hoy" : nombreDia(dia)}
        </h2>
        <Boton aria-label="Día siguiente" onClick={() => setDia(sumarDias(dia, 1))}>
          <ChevronRight aria-hidden className="size-5" />
        </Boton>
      </div>
      <p className="mb-3 text-center text-sm text-tinta-suave">
        {dia === hoy ? nombreDia(dia) : ""}
        {dia === hoy ? " · " : ""}
        {personas} {personas === 1 ? "persona" : "personas"} esperadas
        {dia !== hoy && (
          <>
            {" · "}
            <button type="button" className="underline" onClick={() => setDia(hoy)}>
              Volver a hoy
            </button>
          </>
        )}
      </p>

      {delDia.length === 0 ? (
        <Vacio titulo="Sin reservas este día">
          <p>Las que apuntes salen aquí, y en su mesa del plano dos horas antes.</p>
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {delDia.map((r) => (
            <FilaReserva
              key={r.id}
              reserva={r}
              mesa={nombreMesa(r.mesaId)}
              alEditar={() => setBorrador(r)}
              alSentar={() => setSentando(r)}
            />
          ))}
        </ul>
      )}

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? "Cambiar la reserva" : "Nueva reserva"}
      >
        {borrador && (
          <form onSubmit={guardar} className="grid gap-3">
            <Campo etiqueta="A nombre de">
              <input
                className={claseEntrada}
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                maxLength={40}
                required
                autoComplete="off"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Teléfono">
                <input
                  className={claseEntrada}
                  value={borrador.telefono}
                  onChange={(e) => setBorrador({ ...borrador, telefono: e.target.value })}
                  inputMode="tel"
                  maxLength={20}
                  autoComplete="off"
                />
              </Campo>
              <Campo etiqueta="Personas">
                <input
                  type="number"
                  min={1}
                  max={99}
                  className={claseEntrada}
                  value={borrador.personas}
                  onChange={(e) =>
                    setBorrador({ ...borrador, personas: Math.max(1, Number(e.target.value)) })
                  }
                  required
                />
              </Campo>
              <Campo etiqueta="Día">
                <input
                  type="date"
                  className={claseEntrada}
                  value={borrador.dia}
                  min={borrador.id ? undefined : hoy}
                  onChange={(e) => setBorrador({ ...borrador, dia: e.target.value })}
                  required
                />
              </Campo>
              <Campo etiqueta="Hora">
                <input
                  type="time"
                  className={claseEntrada}
                  value={borrador.hora}
                  onChange={(e) => setBorrador({ ...borrador, hora: e.target.value })}
                  required
                />
              </Campo>
            </div>
            <Campo etiqueta="Mesa" ayuda="Se ve en el plano desde dos horas antes.">
              <select
                className={claseEntrada}
                value={borrador.mesaId ?? ""}
                onChange={(e) => setBorrador({ ...borrador, mesaId: e.target.value || null })}
              >
                <option value="">Sin mesa todavía</option>
                {estado.zonas.map((z) => (
                  <optgroup key={z.id} label={z.nombre}>
                    {estado.mesas
                      .filter((m) => m.zonaId === z.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} ({m.plazas} {m.plazas === 1 ? "plaza" : "plazas"})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Nota (opcional)">
              <input
                className={claseEntrada}
                value={borrador.nota}
                onChange={(e) => setBorrador({ ...borrador, nota: e.target.value })}
                maxLength={200}
                placeholder="Cumpleaños, trona, terraza…"
              />
            </Campo>
            <Boton type="submit" variante="primario" tamano="grande">
              {borrador.id ? "Guardar los cambios" : "Apuntar la reserva"}
            </Boton>
          </form>
        )}
      </Dialogo>

      <Dialogo
        abierto={sentando !== null}
        alCerrar={() => setSentando(null)}
        titulo={`Sentar a ${sentando?.nombre ?? ""}`}
        ancho="max-w-2xl"
      >
        <p className="mb-3">Elige la mesa. Si ya tiene cuenta, se suman a ella.</p>
        {estado.zonas.map((z) => (
          <div key={z.id} className="mb-3">
            <h3 className="mb-1 font-semibold">{z.nombre}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {estado.mesas
                .filter((m) => m.zonaId === z.id)
                .map((m) => {
                  const ocupada = situacionMesa(estado, m).cuenta;
                  return (
                    <Boton
                      key={m.id}
                      variante={m.id === sentando?.mesaId ? "primario" : "secundario"}
                      onClick={async () => {
                        if (
                          sentando &&
                          (await hacer(
                            { tipo: "sentar_reserva", reservaId: sentando.id, mesaId: m.id },
                            `${sentando.nombre}, en ${m.nombre}`,
                          ))
                        )
                          setSentando(null);
                      }}
                    >
                      {m.nombre}
                      {ocupada && <span className="sr-only"> (ocupada)</span>}
                      {ocupada && <Users aria-hidden className="size-3.5" />}
                    </Boton>
                  );
                })}
            </div>
          </div>
        ))}
      </Dialogo>
    </main>
  );
}

function FilaReserva({
  reserva: r,
  mesa,
  conDia,
  alEditar,
  alSentar,
}: {
  reserva: Reserva;
  mesa?: string;
  conDia?: boolean;
  alEditar: () => void;
  alSentar: () => void;
}) {
  const { hacer } = useDatos();
  const cambiar = (estado: Exclude<EstadoReserva, "sentada">, texto: string) =>
    hacer({ tipo: "cambiar_reserva", reservaId: r.id, estado }, texto);
  const viva = pendiente(r);
  return (
    <li className={clsx("rounded-xl p-3 ring-2", COLOR_ESTADO[r.estado])}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <p className="font-rotulo text-2xl leading-none font-bold tabular-nums">{r.hora}</p>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {r.nombre} · {r.personas} {r.personas === 1 ? "persona" : "personas"}
            {r.online && (
              <Smartphone aria-label="Pedida desde la web" className="ml-1 inline size-4" />
            )}
          </p>
          <p className="text-sm text-tinta-suave">
            {conDia && `${nombreDia(r.dia)} · `}
            {TEXTO_ESTADO[r.estado]}
            {mesa ? ` · ${mesa}` : " · Sin mesa"}
            {r.telefono && (
              <>
                {" · "}
                <a
                  href={`tel:${r.telefono.replace(/\s/g, "")}`}
                  className="whitespace-nowrap underline"
                >
                  <Phone aria-hidden className="mr-0.5 inline size-3.5" />
                  {r.telefono}
                </a>
              </>
            )}
          </p>
          {r.nota && <p className="text-sm">«{r.nota}»</p>}
        </div>
      </div>
      {r.estado !== "sentada" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.estado === "por_confirmar" && (
            <Boton
              tamano="pequeno"
              variante="primario"
              onClick={() => cambiar("confirmada", "Reserva confirmada")}
            >
              Confirmar
            </Boton>
          )}
          {viva && (
            <Boton tamano="pequeno" variante="exito" onClick={alSentar}>
              Han llegado
            </Boton>
          )}
          <Boton tamano="pequeno" onClick={alEditar}>
            Cambiar
          </Boton>
          {viva ? (
            <>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                onClick={() => cambiar("cancelada", "Reserva cancelada")}
              >
                Cancelar
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                onClick={() => cambiar("no_vino", "Apuntado: no vino")}
              >
                No vino
              </Boton>
            </>
          ) : (
            <Boton
              tamano="pequeno"
              variante="fantasma"
              onClick={() => cambiar("confirmada", "Reserva recuperada")}
            >
              Recuperar
            </Boton>
          )}
        </div>
      )}
    </li>
  );
}
