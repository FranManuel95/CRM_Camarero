"use client";

import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
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

export function MenuGestion() {
  const ruta = usePathname();
  return (
    <nav aria-label="Gestión" className="no-imprimir md:sticky md:top-18 md:self-start">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {SECCIONES.map(({ href, texto, icono: Icono }) => {
          const activo = href === "/gestion" ? ruta === href : ruta.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={clsx(
                  "flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap",
                  activo ? "bg-cobalto text-white" : "hover:bg-zinc",
                )}
              >
                <Icono aria-hidden className="size-4" />
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
