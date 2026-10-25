import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/servidor/sesion";
import { MenuGestion } from "./menu-gestion";

export default async function LayoutGestion({ children }: { children: React.ReactNode }) {
  if ((await sesionActual())?.empleado.rol !== "encargado") redirect("/sala");
  return (
    <div className="mx-auto grid max-w-screen-2xl grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4 md:grid-cols-[13rem_minmax(0,1fr)]">
      <MenuGestion />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
