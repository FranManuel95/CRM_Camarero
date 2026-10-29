"use client";

import clsx from "clsx";
import { AlertTriangle, Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAhora } from "@/lib/cliente/use-ahora";
import { alertasEncargado } from "@/lib/dominio/alertas";
import { useDatos } from "./datos-personal";

/** Alertas del encargado (vacía para el resto del equipo). */
export function useAlertas() {
  const { estado, empleado } = useDatos();
  const ahora = useAhora(60_000);
  return useMemo(
    () => (empleado.rol === "encargado" ? alertasEncargado(estado, ahora) : []),
    [estado, ahora, empleado.rol],
  );
}

/**
 * Con la app abierta, saca una notificación del navegador cuando aparece una alerta urgente
 * nueva (si el encargado lo ha permitido). Las que ya había al entrar no se repiten.
 */
export function NotificarAlertas() {
  const alertas = useAlertas();
  const vistas = useRef<Set<string> | null>(null);
  useEffect(() => {
    const urgentes = alertas.filter((a) => a.nivel === "urgente");
    if (!vistas.current) {
      vistas.current = new Set(urgentes.map((a) => a.clave));
      return;
    }
    for (const a of urgentes) {
      if (vistas.current.has(a.clave)) continue;
      vistas.current.add(a.clave);
      if (typeof Notification !== "undefined" && Notification.permission === "granted")
        new Notification("Comanda", { body: a.texto, tag: a.clave });
    }
  }, [alertas]);
  return null;
}

/** Lista para el Resumen de Gestión. No sale nada si todo está en orden. */
export function ListaAlertas() {
  const alertas = useAlertas();
  const [, refrescar] = useState(0);
  // En el servidor no hay notificaciones: el botón sale solo en el navegador.
  const permiso = useSyncExternalStore(
    () => () => {},
    () => (typeof Notification === "undefined" ? "no" : Notification.permission),
    () => "no",
  );
  if (!alertas.length) return null;
  return (
    <section aria-labelledby="t-alertas" className="mb-6 rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="t-alertas" className="font-rotulo text-2xl font-bold">
          Para mirar
        </h2>
        {permiso === "default" && (
          <button
            type="button"
            onClick={async () => {
              await Notification.requestPermission();
              refrescar((n) => n + 1);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-cobalto underline"
          >
            <Bell aria-hidden className="size-4" />
            Avisarme aunque esté en otra pestaña
          </button>
        )}
      </div>
      <ul className="grid gap-2">
        {alertas.map((a) => (
          <li key={a.clave}>
            <Link
              href={a.enlace}
              className={clsx(
                "flex items-start gap-2 rounded-lg p-3 text-sm ring-1 hover:ring-2",
                a.nivel === "urgente"
                  ? "bg-aviso-claro ring-aviso"
                  : "bg-ocupada-claro ring-ocupada",
              )}
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {a.texto} <span className="font-semibold underline">Ver</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
