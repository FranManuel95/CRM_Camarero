import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { enLaNube } from "@/lib/servidor/almacen";
import { localesDe } from "@/lib/servidor/nube";
import { duenoActual, esAdmin, localDelAparato } from "@/lib/servidor/sesion";
import { MisBares } from "./mis-bares";

export const metadata: Metadata = { title: "Mis bares" };
export const dynamic = "force-dynamic";

export default async function PaginaMisBares() {
  if (!enLaNube()) redirect("/entrar");
  const dueno = await duenoActual();
  if (!dueno) redirect("/acceder");
  const [bares, vinculado] = await Promise.all([localesDe(dueno), localDelAparato()]);
  return (
    <PaginaCuenta titulo="Mis bares" ancho="max-w-2xl">
      <p className="mb-6 text-sm text-tinta-suave">
        Has entrado como {dueno.email}.
        {esAdmin(dueno) && (
          <>
            {" "}
            <Link href="/admin" className="font-semibold text-cobalto underline">
              Panel de Comanda
            </Link>
          </>
        )}
      </p>
      <MisBares bares={bares} vinculado={vinculado} />
    </PaginaCuenta>
  );
}
