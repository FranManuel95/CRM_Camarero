import { ChefHat, LayoutGrid, QrCode, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { enLaNube, leerEstado, localDemo } from "@/lib/servidor/almacen";
import { BotonDemo } from "./boton-demo";

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
  const demo = localDemo();
  const estado = await leerEstado(demo);
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 1") ?? estado.mesas[0];
  const nube = enLaNube();
  return (
    <main>
      <header className="azulejo">
        <div className="bg-gradient-to-r from-cobalto-oscuro via-cobalto-oscuro/85 to-transparent px-4 py-14 text-white sm:px-10 sm:py-20">
          <div className="max-w-xl">
            <h1 className="font-rotulo text-7xl leading-none font-bold sm:text-8xl">Comanda</h1>
            <p className="mt-4 text-lg">
              {nube ? "El TPV para tu bar" : `El TPV de ${estado.ajustes.nombreLocal}`}: los
              clientes piden desde el QR de su mesa, la comanda sale en cocina y barra, y tú cobras,
              imprimes el ticket y llevas los números del bar.
            </p>
            {nube && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/registro"
                  className="inline-flex h-12 items-center rounded-lg bg-white px-5 font-semibold text-cobalto-oscuro hover:bg-zinc"
                >
                  Dar de alta mi bar
                </Link>
                <Link
                  href="/acceder"
                  className="inline-flex h-12 items-center rounded-lg px-5 font-semibold text-white ring-2 ring-white/70 hover:bg-white/10"
                >
                  Ya tengo cuenta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_18rem]">
        <section aria-labelledby="t-entrar">
          <h2 id="t-entrar" className="mb-3 font-rotulo text-3xl font-bold">
            {nube ? "En un aparato ya vinculado a tu bar" : "¿Qué pantalla abres?"}
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
          {!nube && process.env.DEMO !== "false" && (
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
              href={`/m/${demo}/${mesa.token}`}
              className="inline-flex h-11 items-center rounded-lg bg-cobalto px-4 font-semibold text-white hover:bg-cobalto-oscuro"
            >
              Abrir la carta de {mesa.nombre}
            </Link>
            {nube && (
              <>
                <h2 className="mt-6 font-rotulo text-2xl font-bold">Prueba como camarero</h2>
                <p className="mb-4 text-sm text-tinta-suave">
                  Entra en el bar de demostración. PIN: Ana 1234 (encargada), Luis 1111, Marta 2222.
                </p>
                <BotonDemo />
              </>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
