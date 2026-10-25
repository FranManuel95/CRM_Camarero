"use client";

import { useState } from "react";
import { Boton, Campo, claseEntrada } from "@/components/ui";

const hoyEnMadrid = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

export function FormularioReserva({ local }: { local: string }) {
  const [datos, setDatos] = useState({
    nombre: "",
    telefono: "",
    personas: 2,
    dia: hoyEnMadrid(),
    hora: "21:00",
    nota: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecha, setHecha] = useState(false);
  const cambiar = (cambios: Partial<typeof datos>) => setDatos({ ...datos, ...cambios });

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(`/api/reserva/${local}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const respuesta = (await r.json()) as { error?: string };
      if (respuesta.error) setError(respuesta.error);
      else setHecha(true);
    } catch {
      setError("No hay conexión. Prueba otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  if (hecha)
    return (
      <div role="status" className="rounded-2xl bg-cuenta-claro p-5 text-center ring-2 ring-cuenta">
        <p className="font-rotulo text-2xl font-bold">¡Petición enviada!</p>
        <p className="mt-1">
          Te llamamos al {datos.telefono} para confirmarte la mesa para {datos.personas}.
        </p>
      </div>
    );

  return (
    <form onSubmit={pedir} className="grid gap-3">
      <Campo etiqueta="A nombre de">
        <input
          className={claseEntrada}
          value={datos.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          maxLength={40}
          required
          autoComplete="name"
        />
      </Campo>
      <Campo etiqueta="Teléfono" ayuda="Para confirmarte la reserva.">
        <input
          className={claseEntrada}
          value={datos.telefono}
          onChange={(e) => cambiar({ telefono: e.target.value })}
          inputMode="tel"
          maxLength={15}
          required
          autoComplete="tel"
        />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Personas">
          <input
            type="number"
            min={1}
            max={20}
            className={claseEntrada}
            value={datos.personas}
            onChange={(e) => cambiar({ personas: Math.max(1, Number(e.target.value)) })}
            required
          />
        </Campo>
        <Campo etiqueta="Día" className="col-span-2">
          <input
            type="date"
            className={claseEntrada}
            value={datos.dia}
            min={hoyEnMadrid()}
            onChange={(e) => cambiar({ dia: e.target.value })}
            required
          />
        </Campo>
      </div>
      <Campo etiqueta="Hora">
        <input
          type="time"
          className={claseEntrada}
          value={datos.hora}
          onChange={(e) => cambiar({ hora: e.target.value })}
          required
        />
      </Campo>
      <Campo etiqueta="¿Algo más? (opcional)">
        <input
          className={claseEntrada}
          value={datos.nota}
          onChange={(e) => cambiar({ nota: e.target.value })}
          maxLength={200}
          placeholder="Terraza, trona, cumpleaños…"
        />
      </Campo>
      {error && (
        <p role="alert" className="font-semibold text-aviso">
          {error}
        </p>
      )}
      <Boton type="submit" variante="primario" tamano="grande" disabled={enviando}>
        Pedir la reserva
      </Boton>
      <p className="text-center text-xs text-tinta-suave">
        Usamos tu nombre y teléfono solo para esta reserva.
      </p>
    </form>
  );
}
