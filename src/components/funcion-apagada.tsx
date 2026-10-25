"use client";

import Link from "next/link";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { FUNCIONES, type Funcion } from "@/lib/dominio/funciones";

/** Lo que se ve en una pantalla cuya función está apagada en este bar. */
export function FuncionApagada({ funcion }: { funcion: Funcion }) {
  const { empleado } = useDatos();
  return (
    <div className="mx-auto my-8 max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-zinc">
      <p className="font-rotulo text-2xl font-bold">{FUNCIONES[funcion].nombre} está apagado</p>
      <p className="mt-2 text-tinta-suave">
        {empleado.rol === "encargado" ? (
          <>
            Puedes encenderlo en{" "}
            <Link href="/gestion/funciones" className="font-semibold text-cobalto underline">
              Gestión → Funciones
            </Link>
            .
          </>
        ) : (
          "Si lo necesitas, pídele al encargado que lo encienda."
        )}
      </p>
    </div>
  );
}

/** Enseña la pantalla si la función está encendida; si no, el aviso de que está apagada. */
export function SiFuncion({ funcion, children }: { funcion: Funcion; children: React.ReactNode }) {
  return useFuncion(funcion) ? children : <FuncionApagada funcion={funcion} />;
}
