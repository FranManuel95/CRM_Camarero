"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, claseEntrada } from "./ui";

type Modo = "acceder" | "registro" | "recuperar";

/** Formulario de la cuenta del dueño: entrar, darse de alta o pedir otra contraseña. */
export function FormularioCuenta({ modo, aviso }: { modo: Modo; aviso?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const r = await fetch("/api/dueno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: modo, email: email.trim(), clave }),
    }).catch(() => null);
    const datos = (await r?.json().catch(() => null)) as {
      error?: string;
      confirmar?: boolean;
    } | null;
    setEnviando(false);
    if (!r?.ok) return setError(datos?.error ?? "No hay conexión. Prueba otra vez.");
    if (modo === "recuperar")
      return setHecho(
        "Si hay una cuenta con ese correo, te hemos mandado un enlace para poner otra contraseña.",
      );
    if (datos?.confirmar)
      return setHecho(
        "¡Cuenta creada! Te hemos mandado un correo: abre el enlace para confirmarla y después entra.",
      );
    router.push("/mis-bares");
    router.refresh();
  }

  if (hecho) return <p className="rounded-xl bg-cuenta-claro p-4 font-semibold">{hecho}</p>;

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc">
      {aviso && <p className="rounded-lg bg-cuenta-claro p-3 text-sm font-semibold">{aviso}</p>}
      <Campo etiqueta="Correo">
        <input
          className={claseEntrada}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Campo>
      {modo !== "recuperar" && (
        <Campo
          etiqueta="Contraseña"
          ayuda={modo === "registro" ? "Al menos 8 caracteres." : undefined}
        >
          <input
            className={claseEntrada}
            type="password"
            autoComplete={modo === "registro" ? "new-password" : "current-password"}
            required
            minLength={modo === "registro" ? 8 : 1}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </Campo>
      )}
      <p role="alert" className="min-h-5 text-sm font-semibold text-aviso">
        {error}
      </p>
      <Boton
        type="submit"
        variante="primario"
        tamano="grande"
        className="w-full"
        disabled={enviando}
      >
        {modo === "acceder"
          ? "Entrar"
          : modo === "registro"
            ? "Crear mi cuenta"
            : "Mandarme el enlace"}
      </Boton>
      <p className="text-center text-sm text-tinta-suave">
        {modo === "acceder" ? (
          <>
            ¿Aún no tienes cuenta?{" "}
            <Link className="font-semibold text-cobalto underline" href="/registro">
              Da de alta tu bar
            </Link>
            <br />
            <Link className="font-semibold text-cobalto underline" href="/acceder?olvido=1">
              He olvidado la contraseña
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link className="font-semibold text-cobalto underline" href="/acceder">
              Entra
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
