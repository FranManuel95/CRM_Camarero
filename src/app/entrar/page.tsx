import type { Metadata } from "next";
import { Suspense } from "react";
import { TecladoPin } from "./teclado-pin";

export const metadata: Metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <main className="grid min-h-dvh place-items-center bg-tinta px-4 py-10">
      <div className="w-full max-w-xs">
        <h1 className="mb-1 text-center font-rotulo text-4xl font-bold text-white">Comanda</h1>
        <p className="mb-8 text-center text-zinc-oscuro">Escribe tu PIN para empezar el turno</p>
        <Suspense>
          <TecladoPin />
        </Suspense>
        {process.env.DEMO !== "false" && (
          <p className="mt-8 rounded-lg bg-white/10 p-3 text-center text-sm text-zinc">
            Demostración: Ana (encargada) <b>1234</b> · Luis <b>1111</b> · Marta <b>2222</b>
          </p>
        )}
      </div>
    </main>
  );
}
