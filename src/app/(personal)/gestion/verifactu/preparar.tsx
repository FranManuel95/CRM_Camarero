"use client";

import clsx from "clsx";
import { CircleAlert, CircleCheck, CircleX, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Boton } from "@/components/ui";

type Paso = { titulo: string; estado: "ok" | "aviso" | "falta"; detalle: string };
type Resultado = { encendida: boolean; listo: boolean; pasos: Paso[] };

const ICONO = { ok: CircleCheck, aviso: CircleAlert, falta: CircleX };
const COLOR = { ok: "text-cuenta", aviso: "text-[#9a6200]", falta: "text-aviso" };
const TEXTO = { ok: "Listo", aviso: "Revisar", falta: "Falta" };

/** Lista de lo que hace falta para encender VERI*FACTU, comprobada en el servidor. */
export function PrepararVerifactu({ abierta }: { abierta: boolean }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [mirando, setMirando] = useState(false);
  const [error, setError] = useState("");

  async function comprobar() {
    setMirando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/verifactu/comprobar");
      const datos = (await respuesta.json()) as Resultado & { error?: string };
      if (datos.error) setError(datos.error);
      else setR(datos);
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setMirando(false);
    }
  }

  return (
    <details open={abierta} className="mb-6 max-w-2xl rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <summary className="cursor-pointer font-rotulo text-2xl font-bold">
        Preparar y comprobar
      </summary>
      <p className="mt-2 mb-3 text-sm text-tinta-suave">
        Mira si está todo para mandar los tickets a Hacienda: datos del bar, certificado (se prueba
        la conexión con la AEAT, sin mandar nada) y datos del fabricante.
      </p>
      <Boton onClick={() => void comprobar()} disabled={mirando}>
        <RefreshCw aria-hidden className={clsx("size-4", mirando && "animate-spin")} />
        {mirando ? "Comprobando…" : r ? "Volver a comprobar" : "Comprobar"}
      </Boton>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-aviso">
          {error}
        </p>
      )}
      {r && (
        <div aria-live="polite">
          <ul className="mt-4 space-y-3">
            {r.pasos.map((p) => {
              const Icono = ICONO[p.estado];
              return (
                <li key={p.titulo} className="flex gap-3">
                  <Icono aria-hidden className={clsx("mt-0.5 size-5 shrink-0", COLOR[p.estado])} />
                  <div>
                    <p className="font-semibold">
                      {p.titulo} <span className="sr-only">: {TEXTO[p.estado]}</span>
                    </p>
                    <p className="text-sm text-pretty text-tinta-suave">{p.detalle}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-xl bg-zinc-claro p-3 text-sm">
            {r.listo
              ? r.encendida
                ? "Todo listo y encendido."
                : "Todo listo. Ya puedes encenderlo en "
              : "Cuando no quede nada en rojo, se puede encender en "}
            {!(r.listo && r.encendida) && (
              <Link href="/gestion/funciones" className="font-semibold text-cobalto underline">
                Funciones
              </Link>
            )}
            {!(r.listo && r.encendida) && "."}
          </p>
        </div>
      )}
    </details>
  );
}
