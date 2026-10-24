"use client";

import clsx from "clsx";
import { Check, QrCode, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Vacio } from "@/components/ui";
import { pedidosCocina } from "@/lib/dominio/selectores";
import type { Destino } from "@/lib/dominio/tipos";
import { formatearHora, minutosEntre } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";

/**
 * Pantalla de cocina (KDS): cada tarjeta es una ronda de una mesa. Se toca un plato para
 * marcarlo como listo, o «Todo listo» para la tarjeta entera; el camarero recibe el aviso.
 * Las tarjetas cambian de color con la espera: a los 10 minutos ámbar, a los 20 rojo.
 */
export function Cocina({ destino }: { destino: Destino | "todo" }) {
  const { estado, hacer } = useDatos();
  const ahora = useAhora(15_000);
  const pedidos = pedidosCocina(estado, destino);
  const pendientes = pedidos.filter((p) => p.lineas.some((l) => l.estado === "enviada"));
  const anteriores = useRef<number | null>(null);

  // Un pitido cuando entra un pedido nuevo (si el navegador deja sonar audio).
  useEffect(() => {
    if (anteriores.current !== null && pendientes.length > anteriores.current) pitar();
    anteriores.current = pendientes.length;
  }, [pendientes.length]);

  const resumen = new Map<string, number>();
  for (const p of pendientes)
    for (const l of p.lineas)
      if (l.estado === "enviada") resumen.set(l.nombre, (resumen.get(l.nombre) ?? 0) + l.cantidad);

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-tinta p-3 text-white sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-rotulo text-3xl font-bold">
          {destino === "barra" ? "Barra" : destino === "todo" ? "Cocina y barra" : "Cocina"}
          <span className="ml-3 text-xl font-medium text-zinc-oscuro">
            {pendientes.length} {pendientes.length === 1 ? "pedido en marcha" : "pedidos en marcha"}
          </span>
        </h1>
        {resumen.size > 0 && (
          <p className="text-sm text-zinc">
            Total por hacer:{" "}
            {[...resumen.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([n, c]) => `${c} ${n}`)
              .join(" · ")}
          </p>
        )}
      </div>

      {pedidos.length === 0 ? (
        <div className="grid min-h-[60dvh] place-items-center">
          <Vacio titulo="Sin pedidos">
            Cuando un camarero mande una comanda, o una mesa pida por QR, aparece aquí.
          </Vacio>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
          {pedidos.map((p) => {
            const minutos = minutosEntre(p.enviadaEn, ahora);
            const todoListo = p.lineas.every((l) => l.estado === "lista");
            const deQR = p.lineas.some((l) => l.origen === "qr");
            return (
              <li
                key={p.clave}
                className={clsx(
                  "flex flex-col overflow-hidden rounded-xl bg-white text-tinta",
                  todoListo && "opacity-60",
                )}
              >
                <div
                  className={clsx(
                    "flex items-center justify-between px-3 py-2",
                    todoListo
                      ? "bg-cuenta text-white"
                      : minutos >= 20
                        ? "bg-aviso text-white"
                        : minutos >= 10
                          ? "bg-ocupada"
                          : "bg-zinc",
                  )}
                >
                  <span className="font-rotulo text-2xl font-bold">{p.mesa?.nombre ?? "Mesa"}</span>
                  <span
                    className="text-right text-sm leading-tight font-semibold"
                    suppressHydrationWarning
                  >
                    {formatearHora(p.enviadaEn)} · {minutos} min
                    <br />
                    Ronda {p.ronda} · {p.cuenta.comensales} pax
                  </span>
                </div>
                {deQR && (
                  <p className="flex items-center gap-1 bg-qr-claro px-3 py-1 text-xs font-semibold text-qr">
                    <QrCode aria-hidden className="size-3.5" /> Pedido desde el QR
                  </p>
                )}
                <ul className="flex-1 divide-y divide-zinc">
                  {p.lineas.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() =>
                          hacer({
                            tipo: l.estado === "lista" ? "volver_a_preparar" : "marcar_lista",
                            cuentaId: p.cuenta.id,
                            lineaIds: [l.id],
                          })
                        }
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-zinc-claro"
                      >
                        <span className="w-7 shrink-0 font-rotulo text-2xl leading-none font-bold">
                          {l.cantidad}
                        </span>
                        <span
                          className={clsx(
                            "flex-1",
                            l.estado === "lista" && "text-tinta-suave line-through",
                          )}
                        >
                          <span className="block text-lg leading-tight font-semibold">
                            {l.nombre}
                          </span>
                          {l.opciones.length > 0 && (
                            <span className="block text-sm">
                              {l.opciones.map((o) => o.nombre).join(", ")}
                            </span>
                          )}
                          {l.nota && (
                            <span className="block text-sm font-bold text-aviso">¡{l.nota}!</span>
                          )}
                        </span>
                        <span className="sr-only">
                          {l.estado === "lista"
                            ? "listo; tocar para deshacer"
                            : "tocar cuando esté listo"}
                        </span>
                        {l.estado === "lista" ? (
                          <Undo2 aria-hidden className="size-5 shrink-0 text-tinta-suave" />
                        ) : (
                          <Check aria-hidden className="size-5 shrink-0 text-zinc-oscuro" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="p-2">
                  {todoListo ? (
                    <Boton
                      className="w-full"
                      onClick={() =>
                        hacer({
                          tipo: "marcar_servida",
                          cuentaId: p.cuenta.id,
                          lineaIds: p.lineas.map((l) => l.id),
                        })
                      }
                    >
                      <RotateCcw aria-hidden className="size-4" /> Recogido
                    </Boton>
                  ) : (
                    <Boton
                      variante="exito"
                      className="w-full"
                      onClick={() =>
                        hacer({
                          tipo: "marcar_lista",
                          cuentaId: p.cuenta.id,
                          lineaIds: p.lineas.filter((l) => l.estado === "enviada").map((l) => l.id),
                        })
                      }
                    >
                      <Check aria-hidden className="size-4" /> Todo listo
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function pitar() {
  try {
    const audio = new AudioContext();
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    oscilador.frequency.value = 880;
    volumen.gain.setValueAtTime(0.15, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.4);
  } catch {
    // Sin audio: no pasa nada.
  }
}
