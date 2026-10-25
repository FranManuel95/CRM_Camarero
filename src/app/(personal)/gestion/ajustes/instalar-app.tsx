"use client";

import { Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useFuncion } from "@/components/datos-personal";
import { Boton } from "@/components/ui";
import {
  instalar,
  sePuedeInstalar,
  suscribirInstalar,
  yaInstalada,
} from "@/lib/cliente/app-instalable";

/** Botón para instalar la app en este aparato (o cómo hacerlo, si el navegador no lo ofrece). */
export function InstalarApp() {
  const encendida = useFuncion("appInstalable");
  const puede = useSyncExternalStore(suscribirInstalar, sePuedeInstalar, () => false);
  const instalada = useSyncExternalStore(suscribirInstalar, yaInstalada, () => false);
  if (!encendida) return null;
  return (
    <section
      aria-labelledby="t-app"
      className="mt-6 max-w-2xl space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc"
    >
      <h2 id="t-app" className="flex items-center gap-2 font-rotulo text-2xl font-bold">
        <Smartphone aria-hidden className="size-6" /> App en este aparato
      </h2>
      {instalada ? (
        <p className="text-tinta-suave">Ya estás usando la app instalada.</p>
      ) : puede ? (
        <>
          <p className="text-tinta-suave">
            Instálala para abrirla desde la pantalla de inicio, a pantalla completa.
          </p>
          <Boton variante="primario" onClick={() => void instalar()}>
            Instalar la app
          </Boton>
        </>
      ) : (
        <p className="text-tinta-suave">
          En Android y en el ordenador: menú del navegador → «Instalar app». En iPhone o iPad: botón
          Compartir → «Añadir a la pantalla de inicio».
        </p>
      )}
    </section>
  );
}
