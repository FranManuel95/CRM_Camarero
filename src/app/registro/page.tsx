import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioCuenta } from "@/components/formulario-cuenta";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { enLaNube } from "@/lib/servidor/almacen";
import { duenoActual } from "@/lib/servidor/sesion";

export const metadata: Metadata = { title: "Comanda para tu bar" };

/**
 * Las altas las hace Comanda: monta el bar y le da al dueño su cuenta. Aquí solo se explica
 * (y quien vende Comanda crea su cuenta de administración la primera vez).
 */
export default async function Registro() {
  if (!enLaNube()) redirect("/entrar");
  if (await duenoActual()) redirect("/mis-bares");
  return (
    <PaginaCuenta titulo="Comanda para tu bar">
      <div className="space-y-3 text-tinta-suave">
        <p>
          Las altas las hacemos nosotros: te dejamos el bar montado, con tu carta, tus mesas, tu
          equipo y tus impresoras, y te damos tu cuenta para entrar.
        </p>
        <p>Pídeselo a quien te ha hablado de Comanda y quedamos un día para instalarlo.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/acceder"
          className="inline-flex h-12 items-center rounded-lg bg-cobalto px-5 font-semibold text-white hover:bg-cobalto-oscuro"
        >
          Ya tengo cuenta
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-lg px-5 font-semibold text-cobalto ring-2 ring-cobalto/40 hover:bg-zinc-claro"
        >
          Ver cómo funciona
        </Link>
      </div>
      <details className="mt-10 text-sm">
        <summary className="cursor-pointer text-tinta-suave">
          Cuenta de administración de Comanda
        </summary>
        <p className="my-3 text-tinta-suave">
          Solo para los correos de administración. Con ella das de alta los bares de tus clientes.
        </p>
        <FormularioCuenta modo="registro" />
      </details>
    </PaginaCuenta>
  );
}
