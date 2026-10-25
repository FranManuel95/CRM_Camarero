"use client";

import { useEffect } from "react";
import { useFuncion } from "@/components/datos-personal";
import { prepararApp } from "@/lib/cliente/app-instalable";

/** Pone (o quita) lo necesario para que la app se pueda instalar y abra sin red. */
export function RegistrarApp() {
  const encendida = useFuncion("appInstalable");
  useEffect(() => {
    void prepararApp(encendida);
  }, [encendida]);
  return null;
}
