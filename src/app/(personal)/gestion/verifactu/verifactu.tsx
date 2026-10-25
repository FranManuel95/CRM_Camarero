"use client";

import clsx from "clsx";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Vacio } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import type { EstadoRegistroAeat } from "@/lib/dominio/tipos";
import { formatearFechaHora, formatearHora } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";

const TEXTO: Record<EstadoRegistroAeat, string> = {
  pendiente: "Por mandar",
  correcto: "Aceptado",
  aceptado_con_errores: "Aceptado con avisos",
  incorrecto: "Rechazado",
};

const COLOR: Record<EstadoRegistroAeat, string> = {
  pendiente: "bg-ocupada-claro text-tinta",
  correcto: "bg-cuenta-claro text-tinta",
  aceptado_con_errores: "bg-qr-claro text-tinta",
  incorrecto: "bg-aviso text-white",
};

/** Cómo van los registros de VERI*FACTU: lo mandado a la AEAT, lo pendiente y lo rechazado. */
export function Verifactu() {
  const { estado, avisar } = useDatos();
  const [mandando, setMandando] = useState(false);
  const v = estado.verifactu;
  const registros = [...(v?.registros ?? [])].reverse();
  const cuenta = (e: EstadoRegistroAeat) => registros.filter((r) => r.estado === e).length;
  const ahora = useAhora(5_000);
  const espera = v?.esperarHasta && v.esperarHasta > ahora ? v.esperarHasta : null;

  async function mandar(reintentar?: string) {
    setMandando(true);
    try {
      const r = await fetch("/api/verifactu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reintentar ? { reintentar } : {}),
      });
      const datos = (await r.json()) as { error?: string };
      if (datos.error) avisar(datos.error, "error");
      else avisar(reintentar ? "Vuelto a poner en cola" : "Hecho");
    } catch {
      avisar("No hay conexión con el servidor.", "error");
    } finally {
      setMandando(false);
    }
  }

  return (
    <main>
      <h1 className="mb-1 font-rotulo text-4xl font-bold">VERI*FACTU</h1>
      <p className="mb-4 max-w-2xl text-tinta-suave">
        Cada ticket se manda a la AEAT al cobrarlo, con su huella encadenada, y lleva un QR para que
        el cliente lo compruebe.{" "}
        {estado.entornoAeat === "produccion" ? (
          <strong>Se manda a la AEAT de verdad.</strong>
        ) : (
          <strong>Ahora va al entorno de pruebas de la AEAT (no cuenta para Hacienda).</strong>
        )}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["pendiente", "correcto", "aceptado_con_errores", "incorrecto"] as const).map((e) => (
          <div key={e} className="rounded-xl bg-white p-3 ring-1 ring-zinc">
            <p className="text-sm text-tinta-suave">{TEXTO[e]}</p>
            <p className="font-rotulo text-3xl font-bold">{cuenta(e)}</p>
          </div>
        ))}
      </div>

      {v?.ultimoError && (
        <p role="alert" className="mb-4 rounded-xl bg-aviso-claro p-3 ring-2 ring-aviso">
          {v.ultimoError}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Boton
          variante="primario"
          disabled={mandando || !cuenta("pendiente")}
          onClick={() => mandar()}
        >
          <Send aria-hidden className="size-4" /> Mandar lo pendiente
        </Boton>
        {espera && (
          <p className="text-sm text-tinta-suave">
            La AEAT pide esperar hasta las {formatearHora(espera)} entre envíos.
          </p>
        )}
      </div>

      {registros.length === 0 ? (
        <Vacio titulo="Aún no hay registros">
          <p>Los tickets que cobres a partir de ahora salen aquí.</p>
        </Vacio>
      ) : (
        <div
          className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc"
          role="region"
          aria-label="Registros mandados a la AEAT"
          // Se puede desplazar con el teclado si no cabe en la pantalla.
          tabIndex={0}
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Registros de facturación mandados a la AEAT</caption>
            <thead className="border-b border-zinc text-tinta-suave">
              <tr>
                <th scope="col" className="p-3">
                  Ticket
                </th>
                <th scope="col" className="p-3">
                  Hecho
                </th>
                <th scope="col" className="p-3 text-right">
                  Importe
                </th>
                <th scope="col" className="p-3">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc">
              {registros.slice(0, 100).map((r) => (
                <tr key={r.ticketId}>
                  <td className="p-3 font-semibold whitespace-nowrap">
                    {r.numero}
                    {r.tipoFactura === "R5" && (
                      <span className="block text-xs font-normal">Rectificativa</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatearFechaHora(r.generadoEn)}</td>
                  <td className="p-3 text-right tabular-nums">{euros(r.importeTotal)}</td>
                  <td className="p-3">
                    <span
                      className={clsx(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                        COLOR[r.estado],
                      )}
                    >
                      {TEXTO[r.estado]}
                    </span>
                    {r.error && <span className="mt-1 block text-xs">{r.error}</span>}
                    {r.estado === "incorrecto" && (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        className="mt-1"
                        disabled={mandando}
                        onClick={() => mandar(r.ticketId)}
                      >
                        <RefreshCw aria-hidden className="size-3.5" /> Volver a mandar
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
