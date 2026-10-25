import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioCuenta } from "@/components/formulario-cuenta";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { enLaNube } from "@/lib/servidor/almacen";
import { duenoActual } from "@/lib/servidor/sesion";

export const metadata: Metadata = { title: "Entrar en tu cuenta" };

export default async function Acceder({
  searchParams,
}: {
  searchParams: Promise<{ olvido?: string; confirmado?: string }>;
}) {
  if (!enLaNube()) redirect("/entrar");
  const { olvido, confirmado } = await searchParams;
  if (!olvido && (await duenoActual())) redirect("/mis-bares");
  return (
    <PaginaCuenta titulo={olvido ? "Otra contraseña" : "Entra en tu cuenta"}>
      <FormularioCuenta
        modo={olvido ? "recuperar" : "acceder"}
        aviso={confirmado ? "Correo confirmado. Ya puedes entrar." : undefined}
      />
    </PaginaCuenta>
  );
}
