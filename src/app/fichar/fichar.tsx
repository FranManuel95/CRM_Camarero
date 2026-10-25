"use client";

import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Teclado } from "../entrar/teclado-pin";
import { type FichaPersonal, formatearMinutos } from "@/lib/dominio/equipo";
import { formatearHora } from "@/lib/fechas";

type Ficha = FichaPersonal & { nombre: string };
type Que = "entrada" | "pausa" | "vuelta" | "salida";

const HECHO: Record<Que, string> = {
  entrada: "Entrada apuntada",
  pausa: "Descanso empezado",
  vuelta: "Vuelta del descanso apuntada",
  salida: "Salida apuntada. ¡Hasta la próxima!",
};

const diaCorto = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  timeZone: "UTC",
});

async function pedir(pin: string, que?: Que): Promise<Ficha | { error: string }> {
  const r = await fetch("/api/fichar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, ...(que ? { que } : {}) }),
  }).catch(() => null);
  const datos = (await r?.json().catch(() => null)) as (Ficha & { error?: string }) | null;
  if (!r?.ok || !datos) return { error: datos?.error ?? "No hay conexión con la caja." };
  return datos;
}

/**
 * Primero el PIN; luego, según cómo esté la persona, los botones que tocan (entrar, descanso,
 * salir). Tras fichar vuelve sola al teclado para el siguiente.
 */
export function Fichar() {
  const [pin, setPin] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);

  function terminar() {
    clearTimeout(reloj.current);
    setPin(null);
    setFicha(null);
    setHecho(null);
    setError(null);
  }

  async function fichar(que: Que) {
    if (!pin) return;
    setEnviando(true);
    setError(null);
    const r = await pedir(pin, que);
    setEnviando(false);
    if ("error" in r) return setError(r.error);
    setFicha(r);
    setHecho(`${HECHO[que]} a las ${formatearHora(new Date().toISOString())}.`);
    reloj.current = setTimeout(terminar, 6000);
  }

  if (!ficha || !pin)
    return (
      <Teclado
        etiqueta="Seguir"
        alEnviar={async (valor) => {
          const r = await pedir(valor);
          if ("error" in r) return r.error;
          setPin(valor);
          setFicha(r);
          return null;
        }}
      />
    );

  const botones: { que: Que; texto: string; icono: typeof LogIn; principal?: boolean }[] =
    ficha.situacion === "fuera"
      ? [{ que: "entrada", texto: "Fichar la entrada", icono: LogIn, principal: true }]
      : ficha.situacion === "descanso"
        ? [
            { que: "vuelta", texto: "Volver del descanso", icono: Play, principal: true },
            { que: "salida", texto: "Fichar la salida", icono: LogOut },
          ]
        : [
            { que: "pausa", texto: "Empezar un descanso", icono: Coffee },
            { que: "salida", texto: "Fichar la salida", icono: LogOut, principal: true },
          ];

  return (
    <section aria-labelledby="t-ficha" className="rounded-2xl bg-white p-5 text-tinta">
      <h2 id="t-ficha" className="font-rotulo text-3xl font-bold">
        Hola, {ficha.nombre}
      </h2>
      <p className="mb-4 text-tinta-suave" aria-live="polite">
        {hecho ??
          (ficha.situacion === "fuera"
            ? "Ahora mismo no estás fichado."
            : ficha.situacion === "descanso"
              ? `En el descanso desde las ${formatearHora(ficha.desde!)}.`
              : `Trabajando desde las ${formatearHora(ficha.desde!)}.`)}
      </p>

      {!hecho && (
        <div className="grid gap-2">
          {botones.map(({ que, texto, icono: Icono, principal }) => (
            <button
              key={que}
              type="button"
              disabled={enviando}
              onClick={() => void fichar(que)}
              className={`flex h-14 items-center justify-center gap-2 rounded-xl text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                principal ? "bg-cobalto text-white" : "bg-white ring-1 ring-zinc-oscuro"
              }`}
            >
              <Icono aria-hidden className="size-5" />
              {texto}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-aviso">
          {error}
        </p>
      )}

      <dl className="mt-5 grid gap-3 border-t border-zinc pt-4 text-sm">
        <div>
          <dt className="text-tinta-suave">Tu turno de hoy</dt>
          <dd className="font-semibold">
            {ficha.hoy.length
              ? ficha.hoy
                  .map((t) => `${t.desde}–${t.hasta}${t.puesto ? ` (${t.puesto})` : ""}`)
                  .join(", ")
              : "Hoy no tienes turno en el cuadrante"}
          </dd>
        </div>
        {ficha.proximos.length > 0 && (
          <div>
            <dt className="text-tinta-suave">Próximos turnos</dt>
            {ficha.proximos.map((t) => (
              <dd key={t.dia + t.desde}>
                <span className="capitalize">
                  {diaCorto.format(new Date(`${t.dia}T12:00:00Z`))}
                </span>
                : {t.desde}–{t.hasta}
              </dd>
            ))}
          </div>
        )}
        <div>
          <dt className="text-tinta-suave">Esta semana</dt>
          <dd className="font-semibold">
            {formatearMinutos(ficha.semana.trabajados)} trabajadas
            {ficha.semana.previstos > 0 &&
              ` de ${formatearMinutos(ficha.semana.previstos)} previstas`}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={terminar}
        className="mt-5 h-11 w-full rounded-lg font-semibold ring-1 ring-zinc-oscuro hover:bg-zinc"
      >
        {hecho ? "Listo" : "No es mi PIN / cancelar"}
      </button>
    </section>
  );
}
