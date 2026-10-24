import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DatosPersonal } from "@/components/datos-personal";
import { BarraPersonal } from "@/components/barra-personal";
import { leerEstado } from "@/lib/servidor/almacen";
import { empleadoActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export default async function LayoutPersonal({ children }: { children: React.ReactNode }) {
  const empleado = await empleadoActual();
  if (!empleado) redirect("/entrar");
  return (
    <DatosPersonal
      inicial={vistaPersonal(leerEstado())}
      empleado={{ id: empleado.id, nombre: empleado.nombre, rol: empleado.rol }}
    >
      <Suspense>
        <BarraPersonal />
      </Suspense>
      {children}
    </DatosPersonal>
  );
}
