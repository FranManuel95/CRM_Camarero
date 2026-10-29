import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Clientes } from "./clientes";

export const metadata: Metadata = { title: "Clientes" };

export default function PaginaClientes() {
  return (
    <SiFuncion funcion="club">
      <Clientes />
    </SiFuncion>
  );
}
