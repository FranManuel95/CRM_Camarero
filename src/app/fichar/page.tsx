import type { Metadata } from "next";
import Link from "next/link";
import { leerEstado } from "@/lib/servidor/almacen";
import { localDelAparato } from "@/lib/servidor/sesion";
import { Fichar } from "./fichar";

export const metadata: Metadata = { title: "Fichar" };
export const dynamic = "force-dynamic";

/** Fichar entrada, descanso y salida con el PIN, en el aparato del bar y sin abrir sesión. */
export default async function PaginaFichar() {
  const local = await localDelAparato();
  const nombre = local ? (await leerEstado(local).catch(() => null))?.ajustes.nombreLocal : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-tinta px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center font-rotulo text-4xl font-bold text-white">Fichar</h1>
        {nombre ? (
          <>
            <p className="mb-8 text-center text-zinc-oscuro">{nombre}</p>
            <Fichar />
          </>
        ) : (
          <p className="mb-6 text-center text-zinc-oscuro">
            Este aparato aún no está vinculado a ningún bar.
          </p>
        )}
        <p className="mt-8 text-center text-sm text-zinc">
          <Link href="/entrar" className="font-semibold text-white underline">
            Volver a entrar con el PIN
          </Link>
        </p>
      </div>
    </main>
  );
}
