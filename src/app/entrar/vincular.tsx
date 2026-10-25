"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const campo =
  "h-12 w-full rounded-xl bg-white/10 px-4 text-lg text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none";

/** Vincular con el código de 6 cifras que saca el encargado en Gestión → Equipo. */
export function VincularAparato() {
  const router = useRouter();
  const [local, setLocal] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const r = await fetch("/api/aparato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "codigo", local: local.trim().toLowerCase(), codigo }),
    }).catch(() => null);
    const datos = (await r?.json().catch(() => null)) as { error?: string } | null;
    setEnviando(false);
    if (!r?.ok) return setError(datos?.error ?? "No hay conexión.");
    router.refresh();
  }

  return (
    <form onSubmit={vincular} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-zinc">Identificador del bar</span>
        <input
          className={campo}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="bar-paco"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-zinc">Código de 6 cifras</span>
        <input
          className={`${campo} tracking-[0.4em]`}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
      </label>
      <p role="alert" className="min-h-5 text-sm font-medium text-[#ffb4ab]">
        {error}
      </p>
      <button
        type="submit"
        disabled={enviando || codigo.length !== 6 || !local}
        className="h-12 w-full rounded-xl bg-cobalto font-semibold text-white disabled:opacity-40"
      >
        Vincular este aparato
      </button>
      <p className="text-xs text-zinc-oscuro">
        El encargado saca el código en Gestión → Equipo → Vincular un aparato. Vale 15 minutos.
      </p>
    </form>
  );
}

export function CambiarDeBar() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (
          !confirm(
            "¿Desvincular este aparato? Para volver a usarlo en el bar hará falta un código nuevo.",
          )
        )
          return;
        await fetch("/api/aparato", { method: "DELETE" });
        router.refresh();
      }}
      className="mx-auto mt-6 block text-sm text-zinc-oscuro underline hover:text-white"
    >
      Usar este aparato en otro bar
    </button>
  );
}
