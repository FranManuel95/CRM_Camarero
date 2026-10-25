"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, claseEntrada } from "@/components/ui";

const dos = (n: number) => String(n).padStart(2, "0");

/** Dentro de 45 minutos, al cuarto de hora (hora de Madrid). */
function horaPorDefecto() {
  const partes = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + 45 * 60_000));
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const minutos = Math.min(
    23 * 60 + 45,
    Math.ceil((valor("hour") * 60 + valor("minute")) / 15) * 15,
  );
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

export function FormularioEncargo({ local }: { local: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [recogida, setRecogida] = useState(horaPorDefecto);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function empezar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(`/api/encargo/${local}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, recogida }),
      });
      const datos = (await r.json()) as { enlace?: string; error?: string };
      if (datos.enlace) router.push(datos.enlace);
      else {
        setError(datos.error ?? "No se ha podido empezar el encargo.");
        setEnviando(false);
      }
    } catch {
      setError("No hay conexión. Prueba otra vez.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={empezar} className="grid gap-3">
      <Campo etiqueta="Tu nombre" ayuda="Para dártelo al recogerlo.">
        <input
          className={claseEntrada}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          required
          autoComplete="given-name"
        />
      </Campo>
      <Campo etiqueta="Teléfono" ayuda="Solo para avisarte si hay algún problema con el pedido.">
        <input
          className={claseEntrada}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          maxLength={15}
          required
          autoComplete="tel"
        />
      </Campo>
      <Campo etiqueta="Lo recojo a las">
        <input
          type="time"
          className={claseEntrada}
          value={recogida}
          onChange={(e) => setRecogida(e.target.value)}
          required
        />
      </Campo>
      {error && (
        <p role="alert" className="font-semibold text-aviso">
          {error}
        </p>
      )}
      <Boton type="submit" variante="primario" tamano="grande" disabled={enviando}>
        Elegir de la carta
      </Boton>
      <p className="text-center text-xs text-tinta-suave">
        Guarda el enlace de la carta: con él ves cuándo está listo.
      </p>
    </form>
  );
}
