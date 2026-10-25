"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Vincula este aparato al bar de demostración y lleva al PIN. */
export function BotonDemo() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const r = await fetch("/api/aparato", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modo: "demo" }),
          }).catch(() => null);
          if (r?.ok) router.push("/entrar");
          else setError("No se ha podido abrir la demostración.");
        }}
        className="inline-flex h-11 items-center rounded-lg px-4 font-semibold text-cobalto ring-2 ring-cobalto hover:bg-cobalto-claro"
      >
        Entrar en la demostración
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-aviso">
          {error}
        </p>
      )}
    </>
  );
}
