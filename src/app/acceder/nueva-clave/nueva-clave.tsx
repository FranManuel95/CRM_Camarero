"use client";

import Link from "next/link";
import { useState } from "react";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { useDelNavegador } from "@/lib/cliente/use-guardado";

/**
 * El enlace del correo trae un permiso temporal en la dirección (#access_token=…). Con él, el
 * servidor comprueba que la contraseña no esté filtrada y la cambia en Supabase.
 */
export function NuevaClave() {
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
        setEstado("");
        const r = await fetch("/api/dueno", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "nueva-clave", permiso, clave }),
        }).catch(() => null);
        if (r?.ok) return setEstado("ok");
        const datos = (await r?.json().catch(() => null)) as { error?: string } | null;
        setEstado(datos?.error ?? "No se ha podido guardar. Revisa la conexión y prueba otra vez.");
      }}
    >
      {!permiso && (
        <p className="text-sm text-aviso">Abre esta página desde el enlace del correo.</p>
      )}
      <Campo
        etiqueta="Contraseña nueva"
        ayuda="Al menos 8 caracteres y que no sea de las que circulan por internet."
      >
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
