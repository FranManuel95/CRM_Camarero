import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { Ajustes } from "./ajustes";
import { CopiaSeguridad } from "./copia-seguridad";
import { InstalarApp } from "./instalar-app";

export const metadata: Metadata = { title: "Ajustes" };

export default function PaginaAjustes() {
  return (
    <>
      <Ajustes />
      <InstalarApp />
      <CopiaSeguridad nube={enLaNube()} />
    </>
  );
}
