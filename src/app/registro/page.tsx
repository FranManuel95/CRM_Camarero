import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioCuenta } from "@/components/formulario-cuenta";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { enLaNube } from "@/lib/servidor/almacen";
import { duenoActual } from "@/lib/servidor/sesion";

export const metadata: Metadata = { title: "Da de alta tu bar" };

export default async function Registro() {
  if (!enLaNube()) redirect("/entrar");
  if (await duenoActual()) redirect("/mis-bares");
  return (
    <PaginaCuenta titulo="Da de alta tu bar">
      <p className="mb-6 text-tinta-suave">
        Crea tu cuenta de dueño. Después montas tu bar en dos minutos: carta, mesas, equipo y QR.
      </p>
      <FormularioCuenta modo="registro" />
    </PaginaCuenta>
  );
}
