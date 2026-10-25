"use client";

import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Home,
  LayoutGrid,
  Package,
  Printer,
  Receipt,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const SECCIONES = [
  { href: "/gestion", texto: "Resumen", icono: Home },
  { href: "/gestion/informes", texto: "Informes", icono: BarChart3 },
  { href: "/gestion/gastos", texto: "Gastos", icono: Receipt },
  { href: "/gestion/carta", texto: "Carta", icono: BookOpen },
  { href: "/gestion/stock", texto: "Stock", icono: Package },
  { href: "/gestion/mesas", texto: "Mesas y QR", icono: LayoutGrid },
  { href: "/gestion/equipo", texto: "Equipo", icono: Users },
  { href: "/gestion/impresoras", texto: "Impresoras", icono: Printer },
  { href: "/gestion/ajustes", texto: "Ajustes", icono: SlidersHorizontal },
];

/**
 * Secciones de Gestión: columna fija a la izquierda desde tablet; en el móvil, un botón con la
 * sección en la que estás que despliega todas (así no quedan escondidas en un scroll lateral).
 */
export function MenuGestion() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activa = (href: string) => (href === "/gestion" ? ruta === href : ruta.startsWith(href));
  const actual = SECCIONES.find((s) => activa(s.href)) ?? SECCIONES[0]!;
  const IconoActual = actual.icono;
  return (
    <nav aria-label="Gestión" className="no-imprimir md:sticky md:top-18 md:self-start">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="secciones-gestion"
        onClick={() => setAbierto((a) => !a)}
        className="flex h-11 w-full items-center gap-2 rounded-lg bg-white px-3 font-semibold ring-1 ring-zinc-oscuro md:hidden"
      >
        <IconoActual aria-hidden className="size-4" />
        <span className="mr-auto">{actual.texto}</span>
        <span className="text-sm font-normal text-tinta-suave">Otras secciones</span>
        <ChevronDown aria-hidden className={clsx("size-4 transition", abierto && "rotate-180")} />
      </button>
      <ul
        id="secciones-gestion"
        className={clsx(
          abierto ? "grid" : "hidden",
          "mt-1 grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc",
          "md:mt-0 md:flex md:flex-col md:bg-transparent md:p-0 md:ring-0",
        )}
      >
        {SECCIONES.map(({ href, texto, icono: Icono }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={() => setAbierto(false)}
              aria-current={activa(href) ? "page" : undefined}
              className={clsx(
                "flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap md:h-10",
                activa(href) ? "bg-cobalto text-white" : "hover:bg-zinc",
              )}
            >
              <Icono aria-hidden className="size-4" />
              {texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
