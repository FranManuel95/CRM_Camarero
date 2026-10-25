import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { activa } from "@/lib/dominio/funciones";
import { enLaNube, leerEstado, localDemo } from "@/lib/servidor/almacen";
import { localDelAparato } from "@/lib/servidor/sesion";
import { CambiarDeBar, VincularAparato } from "./vincular";
import { TecladoPin } from "./teclado-pin";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

async function ajustesDelBar(local: string | null) {
  if (!local) return null;
  try {
    return (await leerEstado(local)).ajustes;
  } catch {
    return null;
  }
}

export default async function Entrar() {
  const local = await localDelAparato();
  const ajustes = await ajustesDelBar(local);
  const nombre = ajustes?.nombreLocal ?? null;
  const nube = enLaNube();
  const esDemo = local === localDemo();

  return (
    <main className="grid min-h-dvh place-items-center bg-tinta px-4 py-10">
      <div className="w-full max-w-xs">
        <h1 className="mb-1 text-center font-rotulo text-4xl font-bold text-white">
          {nombre ?? "Comanda"}
        </h1>
        {nombre ? (
          <>
            <p className="mb-8 text-center text-zinc-oscuro">
              Escribe tu PIN para empezar el turno
            </p>
            <Suspense>
              <TecladoPin />
            </Suspense>
            {ajustes && activa(ajustes, "fichajes") && (
              <p className="mt-6 text-center text-sm text-zinc">
                ¿Vienes a fichar?{" "}
                <Link href="/fichar" className="font-semibold text-white underline">
                  Ficha la entrada o la salida
                </Link>
              </p>
            )}
            {esDemo && process.env.DEMO !== "false" && (
              <p className="mt-8 rounded-lg bg-white/10 p-3 text-center text-sm text-zinc">
                Demostración: Ana (encargada) <b>1234</b> · Luis <b>1111</b> · Marta <b>2222</b>
              </p>
            )}
            {nube && <CambiarDeBar />}
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-zinc-oscuro">
              Este aparato aún no está vinculado a ningún bar.
            </p>
            <VincularAparato />
            <p className="mt-6 text-center text-sm text-zinc">
              ¿Eres el dueño?{" "}
              <Link href="/acceder" className="font-semibold text-white underline">
                Entra con tu cuenta
              </Link>{" "}
              y vincúlalo desde allí.
            </p>
            <p className="mt-2 text-center text-sm text-zinc">
              ¿Solo quieres mirar?{" "}
              <Link href="/" className="font-semibold text-white underline">
                Prueba la demostración
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
