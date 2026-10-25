"use client";

import Link from "next/link";
import { useState } from "react";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { useDelNavegador } from "@/lib/cliente/use-guardado";

/**
 * El enlace del correo trae un permiso temporal en la dirección (#access_token=…). Con él se
 * cambia la contraseña directamente en Supabase; no pasa por nuestro servidor.
 */
export function NuevaClave({ url, clavePublica }: { url: string; clavePublica: string }) {
  const permiso = useDelNavegador(
    () => new URLSearchParams(window.location.hash.slice(1)).get("access_token") ?? "",
    "",
  );
  const [clave, setClave] = useState("");
  const [estado, setEstado] = useState<"" | "ok" | string>("");

  if (estado === "ok")
    return (
      <p className="rounded-xl bg-cuenta-claro p-4 font-semibold">
        Contraseña cambiada.{" "}
        <Link href="/acceder" className="underline">
          Entra con ella
        </Link>
        .
      </p>
    );

  return (
    <form
      className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch(`${url}/auth/v1/user`, {
          method: "PUT",
          headers: {
            apikey: clavePublica,
            Authorization: `Bearer ${permiso}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: clave }),
        }).catch(() => null);
        setEstado(
          r?.ok
            ? "ok"
            : "El enlace ha caducado o ya se ha usado. Pide otro desde «He olvidado la contraseña».",
        );
      }}
    >
      {!permiso && (
        <p className="text-sm text-aviso">Abre esta página desde el enlace del correo.</p>
      )}
      <Campo etiqueta="Contraseña nueva" ayuda="Al menos 8 caracteres.">
        <input
          className={claseEntrada}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
      </Campo>
      {estado && (
        <p role="alert" className="text-sm font-semibold text-aviso">
          {estado}
        </p>
      )}
      <Boton type="submit" variante="primario" className="w-full" disabled={!permiso}>
        Guardar contraseña
      </Boton>
    </form>
  );
}
