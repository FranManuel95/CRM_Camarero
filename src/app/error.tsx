"use client";

import Link from "next/link";
import { useEffect } from "react";
import { avisarError } from "@/lib/cliente/avisar-error";

/** Si una pantalla falla: un aviso claro, el fallo al registro y un botón para reintentar. */
export default function ErrorDePantalla({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => avisarError(error, error.digest), [error]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="mb-2 font-rotulo text-4xl font-bold">Algo ha fallado</h1>
        <p className="mb-4 text-tinta-suave">
          Ya nos ha llegado el aviso. Lo que tenías guardado sigue guardado.
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-lg bg-cobalto px-4 font-semibold text-white"
          >
            Probar otra vez
          </button>
          <Link
            href="/sala"
            className="inline-flex h-11 items-center rounded-lg px-4 font-semibold underline"
          >
            Ir a la sala
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-tinta-suave">Código del fallo: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
