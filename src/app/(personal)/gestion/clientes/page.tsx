import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Clientes } from "./clientes";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  return (
    <SiFuncion funcion="club">
      <Clientes key={cliente} abrirCliente={cliente} />
    </SiFuncion>
  );
}
