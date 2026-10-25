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
      <Suspense>
        <BarraPersonal />
      </Suspense>
      <RegistrarApp />
      {children}
    </DatosPersonal>
  );
}
