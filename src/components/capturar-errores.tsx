"use client";

import { useEffect } from "react";
import { avisarError } from "@/lib/cliente/avisar-error";

/** Escucha los errores que se escapan en el navegador y los manda al servidor. */
export function CapturarErrores() {
  useEffect(() => {
    const alError = (e: ErrorEvent) => avisarError(e.error ?? e.message);
    const alRechazo = (e: PromiseRejectionEvent) => avisarError(e.reason);
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
