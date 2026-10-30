"use client";

import { useEffect } from "react";
import { avisarError } from "@/lib/cliente/avisar-error";

/** Último recurso: falla hasta el diseño de la página. Sin estilos de la app, pero se entiende. */
export default function ErrorGrave({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => avisarError(error, error.digest), [error]);
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1>Algo ha fallado</h1>
        <p>Ya nos ha llegado el aviso. Recarga la página para seguir.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: "10px 16px" }}
        >
          Recargar
        </button>
      </body>
    </html>
  );
}
