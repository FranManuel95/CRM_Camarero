"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { guardarTarjeta } from "./tarjeta-local";

export function FormularioClub({
  local,
  nombreLocal,
  mesa,
}: {
  local: string;
  nombreLocal: string;
  mesa?: string;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState({
    nombre: "",
    telefono: "",
    correo: "",
    comunicaciones: false,
    acepto: false,
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c: Partial<typeof datos>) => setDatos({ ...datos, ...c });

  async function apuntarme(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(`/api/club/${local}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, ...(mesa ? { mesa } : {}) }),
      });
      const respuesta = (await r.json()) as { codigo?: string; tarjeta?: string; error?: string };
      if (respuesta.codigo && respuesta.tarjeta) {
        guardarTarjeta(local, respuesta.codigo);
        router.push(respuesta.tarjeta + (mesa ? `?mesa=${mesa}` : ""));
      } else {
        setError(respuesta.error ?? "No se ha podido completar el alta.");
        setEnviando(false);
      }
    } catch {
      setError("No hay conexión. Prueba otra vez.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={apuntarme} className="grid gap-3">
      <Campo etiqueta="Tu nombre">
        <input
          className={claseEntrada}
          value={datos.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          maxLength={60}
          required
          autoComplete="name"
        />
      </Campo>
      <Campo etiqueta="Teléfono" ayuda="Para encontrarte en la caja.">
        <input
          className={claseEntrada}
          value={datos.telefono}
          onChange={(e) => cambiar({ telefono: e.target.value })}
          inputMode="tel"
          maxLength={16}
          required
          autoComplete="tel"
        />
      </Campo>
      <Campo etiqueta="Correo (opcional)">
        <input
          type="email"
          className={claseEntrada}
          value={datos.correo}
          onChange={(e) => cambiar({ correo: e.target.value })}
          maxLength={120}
          autoComplete="email"
        />
      </Campo>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={datos.acepto}
          onChange={(e) => cambiar({ acepto: e.target.checked })}
          required
        />
        <span className="text-sm">
          Acepto que {nombreLocal} guarde mi nombre, mi teléfono y lo que consumo para el club de
          puntos. Puedo pedir que lo borren cuando quiera.
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={datos.comunicaciones}
          onChange={(e) => cambiar({ comunicaciones: e.target.checked })}
        />
        <span className="text-sm">Quiero recibir ofertas y novedades (opcional).</span>
      </label>
      {error && (
        <p role="alert" className="font-semibold text-aviso">
          {error}
        </p>
      )}
      <Boton type="submit" variante="primario" tamano="grande" disabled={enviando || !datos.acepto}>
        Apuntarme
      </Boton>
    </form>
  );
}
