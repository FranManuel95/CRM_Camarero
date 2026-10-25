"use client";

import clsx from "clsx";
import { Beer, ChefHat, Clock, LayoutGrid, LogOut, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDatos } from "./datos-personal";

export function BarraPersonal() {
  const { empleado, estado } = useDatos();
  const ruta = usePathname();
  const destino = useSearchParams().get("destino");
  const router = useRouter();
  const avisosPendientes = estado.avisos.filter((a) => !a.atendido && a.tipo !== "listo").length;

  const enlaces = [
    {
      href: "/sala",
      texto: "Sala",
      icono: LayoutGrid,
      activo: ruta.startsWith("/sala"),
      contador: avisosPendientes,
    },
    {
      href: "/cocina",
      texto: "Cocina",
      icono: ChefHat,
      activo: ruta === "/cocina" && destino !== "barra",
    },
    {
      href: "/cocina?destino=barra",
      texto: "Barra",
      icono: Beer,
      activo: ruta === "/cocina" && destino === "barra",
    },
    { href: "/caja", texto: "Caja", icono: Wallet, activo: ruta.startsWith("/caja") },
    ...(empleado.rol === "encargado"
      ? [
          {
            href: "/gestion",
            texto: "Gestión",
            icono: Settings,
            activo: ruta.startsWith("/gestion"),
          },
        ]
      : []),
  ];

  async function salir() {
    await fetch("/api/sesion", { method: "DELETE" });
    router.replace("/entrar");
  }

  return (
    <header className="no-imprimir sticky top-0 z-40 bg-tinta text-white">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-14 max-w-screen-2xl items-center gap-1 px-2 sm:px-4"
      >
        <Link href="/sala" className="mr-2 hidden font-rotulo text-2xl font-bold sm:block">
          {estado.ajustes.nombreLocal}
        </Link>
        <ul className="flex flex-1 items-center gap-1 overflow-x-auto">
          {enlaces.map(({ href, texto, icono: Icono, activo, contador }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={clsx(
                  "relative flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
                  activo ? "bg-white text-tinta" : "text-zinc hover:bg-white/10",
                )}
              >
                <Icono aria-hidden className="size-4" />
                {texto}
                {contador ? (
                  <span className="ml-0.5 grid min-w-5 place-items-center rounded-full bg-aviso px-1 text-xs text-white">
                    {contador}
                    <span className="sr-only"> avisos</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
        <span className="hidden text-sm text-zinc-oscuro md:inline">{empleado.nombre}</span>
        <Link
          href="/fichar"
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-zinc hover:bg-white/10"
        >
          <Clock aria-hidden className="size-4" />
          <span className="hidden sm:inline">Fichar</span>
          <span className="sr-only sm:hidden">Fichar</span>
        </Link>
        <button
          type="button"
          onClick={salir}
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-zinc hover:bg-white/10"
        >
          <LogOut aria-hidden className="size-4" />
          <span className="hidden sm:inline">Salir</span>
          <span className="sr-only sm:hidden">Salir</span>
        </button>
      </nav>
    </header>
  );
}
