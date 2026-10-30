"use client";

import { useEffect, useMemo, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import type { Rango } from "../dominio/informes";
import type { Estado, Ticket } from "../dominio/tipos";

/**
 * Lo pedido ya, por periodo. Los tickets no cambian nunca, así que se guardan mientras la app
 * esté abierta y varias pantallas con el mismo periodo comparten una sola petición.
 */
const pedidos = new Map<string, Promise<Ticket[]>>();

function pedir(rango: Rango): Promise<Ticket[]> {
  const clave = `${rango.desde}|${rango.hasta}`;
  let p = pedidos.get(clave);
  if (!p) {
    const url = `/api/tickets?desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`;
    p = fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return ((await r.json()) as { tickets: Ticket[] }).tickets;
      })
      .catch((e: unknown) => {
        pedidos.delete(clave);
        throw e;
      });
    pedidos.set(clave, p);
  }
  return p;
}

/**
 * Los datos del bar con los tickets de un periodo (para informes, resumen, propinas…): los de
 * días pasados se piden al servidor y se juntan con los de hoy, que llegan en directo.
 * `activo: false` no pide nada (por ejemplo, el buscador mientras está cerrado).
 */
export function useConTickets(
  rango: Rango,
  activo = true,
): { estado: Estado; cargando: boolean; error: boolean } {
  const { estado } = useDatos();
  const [leidos, setLeidos] = useState<{ clave: string; tickets: Ticket[] } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const clave = `${rango.desde}|${rango.hasta}`;

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    pedir(rango).then(
      (tickets) => vigente && setLeidos({ clave, tickets }),
      () => vigente && setFallo(clave),
    );
    return () => {
      vigente = false;
    };
    // rango va dentro de «clave».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo]);

  const conTickets = useMemo(() => {
    const viejos = leidos?.clave === clave ? leidos.tickets : [];
    const vistos = new Set(estado.tickets.map((t) => t.id));
    const todos = [...viejos.filter((t) => !vistos.has(t.id)), ...estado.tickets]
      .filter((t) => t.fecha >= rango.desde && t.fecha < rango.hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { ...estado, tickets: todos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, leidos, clave]);

  return {
    estado: conTickets,
    cargando: activo && leidos?.clave !== clave && fallo !== clave,
    error: fallo === clave,
  };
}
