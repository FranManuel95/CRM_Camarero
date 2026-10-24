"use client";

import { useEffect, useState } from "react";

/** La hora actual, refrescada cada `cadaMs` (para los minutos que lleva una mesa o un plato). */
export function useAhora(cadaMs = 30_000): string {
  const [ahora, setAhora] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date().toISOString()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ahora;
}
