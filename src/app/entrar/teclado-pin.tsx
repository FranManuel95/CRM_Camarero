"use client";

import { Delete } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "entrar"] as const;

/** Teclado del PIN para entrar en la app. */
export function TecladoPin() {
  const router = useRouter();
  const vuelta = useSearchParams().get("vuelta");
  return (
    <Teclado
      etiqueta="Entrar"
      alEnviar={async (pin) => {
        const r = await fetch("/api/sesion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }).catch(() => null);
        const datos = (await r?.json().catch(() => null)) as { error?: string } | null;
        if (!r?.ok) return datos?.error ?? "No hay conexión con la caja.";
        // Solo direcciones de esta web: «//otra-web.com» también empieza por «/».
        router.replace(vuelta && /^\/(?![\/\\])/.test(vuelta) ? vuelta : "/sala");
        router.refresh();
        return null;
      }}
    />
  );
}

/**
 * Teclado numérico para el PIN. `alEnviar` hace lo que toque con él y devuelve el error que hay
 * que enseñar (o null si fue bien).
 */
export function Teclado({
  etiqueta,
  alEnviar,
}: {
  etiqueta: string;
  alEnviar: (pin: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(valor = pin) {
    if (valor.length < 4 || enviando) return;
    setEnviando(true);
    setError("");
    const fallo = await alEnviar(valor);
    setEnviando(false);
    if (fallo) {
      setError(fallo);
      setPin("");
    }
  }

  function pulsar(tecla: (typeof TECLAS)[number]) {
    if (tecla === "borrar") setPin((p) => p.slice(0, -1));
    else if (tecla === "entrar") void entrar();
    else if (pin.length < 6) setPin((p) => p + tecla);
  }

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void entrar();
      }}
    >
      <label htmlFor="pin" className="sr-only">
        PIN
      </label>
      <input
        id="pin"
        value={pin}
        readOnly
        type="password"
        inputMode="none"
        aria-describedby={error ? "error-pin" : undefined}
        className="mb-2 h-14 w-full rounded-xl bg-white/10 text-center font-rotulo text-4xl tracking-[0.5em] text-white"
      />
      <p
        id="error-pin"
        role="alert"
        className="mb-3 min-h-6 text-center text-sm font-medium text-[#ffb4ab]"
      >
        {error}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((t) => (
          <button
            key={t}
            type={t === "entrar" ? "submit" : "button"}
            onClick={t === "entrar" ? undefined : () => pulsar(t)}
            disabled={t === "entrar" && (pin.length < 4 || enviando)}
            aria-label={t === "borrar" ? "Borrar" : t === "entrar" ? etiqueta : t}
            className={`grid h-16 place-items-center rounded-xl font-rotulo text-3xl font-semibold transition active:scale-95 disabled:opacity-40 ${
              t === "entrar"
                ? "bg-cobalto text-xl text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {t === "borrar" ? <Delete aria-hidden /> : t === "entrar" ? etiqueta : t}
          </button>
        ))}
      </div>
    </form>
  );
}
