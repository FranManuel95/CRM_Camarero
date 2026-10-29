"use client";

import { Printer, Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada, Dialogo } from "@/components/ui";
import { buscarEnGestion, type Resultado } from "@/lib/dominio/buscador";
import { euros } from "@/lib/dominio/importes";
import type { Ticket } from "@/lib/dominio/tipos";

/**
 * Buscador de Gestión: «croquetas», «ticket 145», «Marta», «NIF»… y te lleva al sitio.
 * Ctrl+K (o Cmd+K) lo enfoca desde cualquier pantalla de Gestión.
 */
export function BuscadorGestion() {
  const { estado } = useDatos();
  const [consulta, setConsulta] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const diferida = useDeferredValue(consulta);
  const entrada = useRef<HTMLInputElement>(null);
  const resultados = buscarEnGestion(estado, diferida);
  const grupos = Map.groupBy(resultados, (r) => r.grupo);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        entrada.current?.focus();
      }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  const cerrar = () => setConsulta("");
  const abierto = consulta.trim().length >= 2;

  return (
    <div role="search" className="relative mb-4">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-3 left-3 size-5 text-tinta-suave"
      />
      <input
        ref={entrada}
        type="search"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && cerrar()}
        placeholder="Buscar un producto, un ticket, un cliente, una sección…"
        aria-label="Buscar en Gestión"
        aria-controls={abierto ? "resultados-gestion" : undefined}
        className={`${claseEntrada} pl-10`}
      />
      {abierto && (
        <div
          id="resultados-gestion"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[70vh] overflow-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-zinc-oscuro"
        >
          <p className="sr-only" aria-live="polite">
            {resultados.length} resultados
          </p>
          {resultados.length === 0 ? (
            <p className="p-2 text-sm text-tinta-suave">No encuentro nada con «{consulta}».</p>
          ) : (
            [...grupos.entries()].map(([grupo, lista]) => (
              <section key={grupo} aria-label={grupo} className="mb-1">
                <h2 className="px-2 pt-1 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
                  {grupo}
                </h2>
                <ul>
                  {lista.map((r) => (
                    <li key={r.clave}>
                      <Fila
                        resultado={r}
                        alElegir={() => {
                          if (r.ticket) setTicket(r.ticket);
                          cerrar();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
      <DetalleTicket ticket={ticket} alCerrar={() => setTicket(null)} />
    </div>
  );
}

function Fila({ resultado: r, alElegir }: { resultado: Resultado; alElegir: () => void }) {
  const contenido = (
    <>
      <span className="block font-semibold">{r.texto}</span>
      <span className="block text-sm text-tinta-suave">{r.detalle}</span>
    </>
  );
  const clase = "block w-full rounded-lg px-2 py-1.5 text-left hover:bg-zinc-claro";
  return r.enlace ? (
    <Link href={r.enlace} onClick={alElegir} className={clase}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={alElegir} className={clase}>
      {contenido}
    </button>
  );
}

function DetalleTicket({ ticket, alCerrar }: { ticket: Ticket | null; alCerrar: () => void }) {
  const { hacer } = useDatos();
  return (
    <Dialogo
      abierto={ticket !== null}
      alCerrar={alCerrar}
      titulo={`Ticket ${ticket?.numero ?? ""}`}
    >
      {ticket && (
        <>
          <p className="mb-2 text-sm text-tinta-suave">
            {ticket.mesaNombre} ·{" "}
            {new Date(ticket.fecha).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid",
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
          <ul className="mb-3 divide-y divide-zinc">
            {ticket.lineas.map((l, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>
                  {l.cantidad} {l.nombre}
                </span>
                <span className="tabular-nums">{euros(l.importe)}</span>
              </li>
            ))}
          </ul>
          <p className="mb-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{euros(ticket.total)}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" onClick={alCerrar}>
              <X aria-hidden className="size-4" /> Cerrar
            </Boton>
            <Boton
              variante="primario"
              onClick={() =>
                hacer(
                  { tipo: "reimprimir_ticket", ticketId: ticket.id },
                  "Ticket enviado a imprimir",
                )
              }
            >
              <Printer aria-hidden className="size-4" /> Reimprimir
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
