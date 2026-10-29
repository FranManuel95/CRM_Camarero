"use client";

import { useEffect } from "react";
import { guardarTarjeta } from "../tarjeta-local";

/** Al abrir la tarjeta, el móvil la recuerda para sumar puntos desde la carta. */
export function RecordarTarjeta({ local, codigo }: { local: string; codigo: string }) {
  useEffect(() => guardarTarjeta(local, codigo), [local, codigo]);
  return null;
}
