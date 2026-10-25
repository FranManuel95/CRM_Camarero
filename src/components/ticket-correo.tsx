"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada } from "@/components/ui";

/** Manda un ticket al correo que dé el cliente. El correo no se guarda en ningún sitio. */
export function TicketPorCorreo({ ticketId }: { ticketId: string }) {
  const { avisar } = useDatos();
  const [correo, setCorreo] = useState("");
  const [mandando, setMandando] = useState(false);

  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    setMandando(true);
    try {
      const r = await fetch("/api/ticket-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, correo }),
      });
      const datos = (await r.json()) as { error?: string };
      if (datos.error) avisar(datos.error, "error");
      else {
        avisar("Ticket mandado por correo");
        setCorreo("");
      }
    } catch {
      avisar("No hay conexión. Prueba otra vez.", "error");
    } finally {
      setMandando(false);
    }
  }

  return (
    <form onSubmit={mandar} className="mt-4 flex gap-2 border-t border-zinc pt-4">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Correo del cliente</span>
        <input
          type="email"
          required
          className={claseEntrada}
          placeholder="Correo del cliente"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          autoComplete="off"
        />
      </label>
      <Boton type="submit" disabled={mandando}>
        <Mail aria-hidden className="size-4" /> Mandar
      </Boton>
    </form>
  );
}
