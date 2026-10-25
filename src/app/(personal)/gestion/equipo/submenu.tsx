"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { sinSalida } from "@/lib/dominio/equipo";
import { useAhora } from "@/lib/cliente/use-ahora";

const SECCIONES: { href: string; texto: string; funcion?: "cuadrante" | "fichajes" }[] = [
  { href: "/gestion/equipo", texto: "Personas" },
  { href: "/gestion/equipo/cuadrante", texto: "Cuadrante", funcion: "cuadrante" },
  { href: "/gestion/equipo/fichajes", texto: "Fichajes", funcion: "fichajes" },
];

export function SubmenuEquipo() {
  const ruta = usePathname();
  const { estado } = useDatos();
  const ahora = useAhora(60_000);
  const olvidos = sinSalida(estado.fichajes, ahora).length;
  const encendidas = { cuadrante: useFuncion("cuadrante"), fichajes: useFuncion("fichajes") };
  return (
    <nav aria-label="Equipo" className="no-imprimir mb-4">
      <ul className="flex gap-1 overflow-x-auto">
        {SECCIONES.filter((s) => !s.funcion || encendidas[s.funcion]).map(({ href, texto }) => {
          const activo = ruta === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={clsx(
                  "flex h-10 items-center gap-1.5 rounded-lg px-4 font-semibold whitespace-nowrap",
                  activo
                    ? "bg-cobalto text-white"
                    : "bg-white ring-1 ring-zinc-oscuro hover:bg-zinc",
                )}
              >
                {texto}
                {href.endsWith("fichajes") && olvidos > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-aviso px-1 text-xs text-white">
                    {olvidos}
                    <span className="sr-only"> sin salida</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
