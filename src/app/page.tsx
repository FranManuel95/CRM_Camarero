import { ChefHat, LayoutGrid, QrCode, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { leerEstado } from "@/lib/servidor/almacen";

export const dynamic = "force-dynamic";

const PUERTAS = [
  {
    href: "/sala",
    icono: LayoutGrid,
    titulo: "Sala",
    texto: "Para el camarero, en el móvil o la PDA: mesas, comandas y cobro.",
  },
  {
    href: "/cocina",
    icono: ChefHat,
    titulo: "Cocina y barra",
    texto: "La pantalla de pedidos. Se toca cada plato cuando sale.",
  },
  {
    href: "/caja",
    icono: Wallet,
    titulo: "Caja",
    texto: "Apertura, tickets del turno, entradas y salidas, y cierre Z.",
  },
  {
    href: "/gestion",
    icono: Settings,
    titulo: "Gestión",
    texto: "Carta, mesas y QR, gastos, informes, equipo e impresoras.",
  },
];

export default async function Portada() {
  const estado = await leerEstado();
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 1") ?? estado.mesas[0];
  return (
    <main>
      <header className="azulejo">
        <div className="bg-gradient-to-r from-cobalto-oscuro via-cobalto-oscuro/85 to-transparent px-4 py-14 text-white sm:px-10 sm:py-20">
          <div className="max-w-xl">
            <h1 className="font-rotulo text-7xl leading-none font-bold sm:text-8xl">Comanda</h1>
            <p className="mt-4 text-lg">
              El TPV de {estado.ajustes.nombreLocal}: los clientes piden desde el QR de su mesa, la
              comanda sale en cocina y barra, y tú cobras, imprimes el ticket y llevas los números
              del bar.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_18rem]">
        <section aria-labelledby="t-entrar">
          <h2 id="t-entrar" className="mb-3 font-rotulo text-3xl font-bold">
            ¿Qué pantalla abres?
          </h2>
          <ul className="divide-y divide-zinc-oscuro/50 border-y border-zinc-oscuro/50">
            {PUERTAS.map(({ href, icono: Icono, titulo, texto }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-4 py-4">
                  <Icono aria-hidden className="size-8 shrink-0 text-cobalto" />
                  <span>
                    <span className="block font-rotulo text-2xl font-bold group-hover:underline">
                      {titulo}
                    </span>
                    <span className="block text-tinta-suave">{texto}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {process.env.DEMO !== "false" && (
            <p className="mt-4 text-sm text-tinta-suave">
              Cada persona entra con su PIN. En la demostración: Ana 1234 (encargada), Luis 1111,
              Marta 2222.
            </p>
          )}
        </section>

        {mesa && (
          <aside
            aria-labelledby="t-qr"
            className="self-start rounded-2xl bg-white p-5 ring-1 ring-zinc"
          >
            <QrCode aria-hidden className="mb-2 size-8 text-cobalto" />
            <h2 id="t-qr" className="font-rotulo text-2xl font-bold">
              Prueba como cliente
            </h2>
            <p className="mb-4 text-sm text-tinta-suave">
              Así ve la carta quien escanea el QR de {mesa.nombre}. Pide algo y míralo llegar a la
              sala y a la cocina.
            </p>
            <Link
              href={`/m/${mesa.token}`}
              className="inline-flex h-11 items-center rounded-lg bg-cobalto px-4 font-semibold text-white hover:bg-cobalto-oscuro"
            >
              Abrir la carta de {mesa.nombre}
            </Link>
          </aside>
        )}
      </div>
    </main>
  );
}
