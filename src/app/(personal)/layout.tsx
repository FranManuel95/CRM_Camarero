import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BarraPersonal } from "@/components/barra-personal";
import { DatosPersonal } from "@/components/datos-personal";
import { RegistrarApp } from "@/components/registrar-app";
import { configDirecto, leerEstado } from "@/lib/servidor/almacen";
import { sesionActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export default async function LayoutPersonal({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/entrar");
  const { local, empleado } = sesion;
  return (
    <DatosPersonal
      inicial={vistaPersonal(await leerEstado(local), local, empleado)}
      directo={configDirecto(local)}
      empleado={{ id: empleado.id, nombre: empleado.nombre, rol: empleado.rol }}
    >
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-cobalto px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <Suspense>
        <BarraPersonal />
      </Suspense>
      <RegistrarApp />
      {/* Destino del enlace de arriba: el foco llega aquí sin marco (no es un control). */}
      <div id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>
    </DatosPersonal>
  );
}
