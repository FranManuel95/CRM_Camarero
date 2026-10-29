"use client";

import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartaTpv } from "@/components/carta-tpv";
import { useDatos, useFuncion, usePuede } from "@/components/datos-personal";
import { FuncionApagada } from "@/components/funcion-apagada";
import { Boton, Vacio } from "@/components/ui";
import type { LineaPedida } from "@/lib/dominio/acciones";
import { euros, importeLinea } from "@/lib/dominio/importes";
import type { LineaCuenta, Producto } from "@/lib/dominio/tipos";
import { Cobrar } from "../[mesaId]/cobrar";
import { PedirResena, useEnlaceResena } from "@/components/qr-resena";

type EnCesta = LineaPedida & { clave: string };

/** Cómo quedaría la línea en la cuenta (para enseñar el precio y cobrar). */
function comoLinea(l: EnCesta, producto: Producto): LineaCuenta {
  const opciones = producto.grupos.flatMap((g) =>
    g.opciones
      .filter((o) => l.opciones.includes(o.id))
      .map((o) => ({ grupo: g.nombre, nombre: o.nombre, suplemento: o.suplemento })),
  );
  return {
    id: l.clave,
    productoId: producto.id,
    nombre: producto.nombre,
    precioUnitario: producto.precio,
    iva: producto.iva,
    destino: "barra",
    cantidad: l.cantidad,
    opciones,
    nota: l.nota,
    estado: "anotada",
    origen: "camarero",
    empleadoId: null,
    creadaEn: "",
    enviadaEn: null,
    listaEn: null,
    ronda: 0,
    invitacion: false,
  };
}

/**
 * Venta rápida: para la barra o lo que se lleva, sin abrir mesa. Se anota, se cobra y sale el
 * ticket (y la comanda, si hay algo de cocina).
 */
export function VentaRapida() {
  const { estado, hacer } = useDatos();
  const puedeCobrar = usePuede("cobrar");
  const propinas = useFuncion("propinas");
  const activa = useFuncion("ventaRapida");
  const [cesta, setCesta] = useState<EnCesta[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const enlaceResena = useEnlaceResena();
  const [cobrado, setCobrado] = useState<string | null>(null);
  const porId = new Map(estado.productos.map((p) => [p.id, p]));
  const lineas = cesta.flatMap((l) => {
    const p = porId.get(l.productoId);
    return p ? [comoLinea(l, p)] : [];
  });
  const total = lineas.reduce((s, l) => s + importeLinea(l), 0);

  async function anotar(linea: LineaPedida) {
    const clave = `${linea.productoId}|${[...linea.opciones].sort().join(",")}|${linea.nota}`;
    setCesta((c) =>
      c.some((x) => x.clave === clave)
        ? c.map((x) =>
            x.clave === clave ? { ...x, cantidad: Math.min(99, x.cantidad + linea.cantidad) } : x,
          )
        : [...c, { ...linea, despues: false, clave }],
    );
    return true;
  }
  const cambiar = (clave: string, delta: number) =>
    setCesta((c) =>
      c.flatMap((x) =>
        x.clave !== clave
          ? [x]
          : x.cantidad + delta > 0
            ? [{ ...x, cantidad: x.cantidad + delta }]
            : [],
      ),
    );

  if (!activa) return <FuncionApagada funcion="ventaRapida" />;

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col lg:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-x-2 border-b border-zinc-oscuro/50 bg-white px-3 py-2">
        <Link href="/sala" className="rounded-lg p-2 hover:bg-zinc" aria-label="Volver a la sala">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="font-rotulo text-3xl font-bold">Venta rápida</h1>
        <p className="basis-full pb-1 text-sm text-tinta-suave sm:basis-auto sm:pb-0">
          Barra o para llevar: se cobra al momento, sin abrir mesa.
        </p>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_24rem]">
        <section aria-label="Carta" className="min-h-0 overflow-y-auto p-3">
          <CartaTpv alAnotar={anotar} />
        </section>
        <section
          aria-label="Lo que se lleva"
          className="flex min-h-0 flex-col border-zinc-oscuro/50 bg-white lg:border-l"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {lineas.length === 0 ? (
              <Vacio titulo="Nada todavía">Toca lo que pide el cliente.</Vacio>
            ) : (
              <ul className="divide-y divide-zinc">
                {lineas.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.nombre}</span>
                      {l.opciones.length > 0 && (
                        <span className="block text-sm text-tinta-suave">
                          {l.opciones.map((o) => o.nombre).join(", ")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-2 ring-1 ring-zinc-oscuro"
                      aria-label={`Una ${l.nombre} menos`}
                      onClick={() => cambiar(l.id, -1)}
                    >
                      {l.cantidad === 1 ? (
                        <Trash2 aria-hidden className="size-4" />
                      ) : (
                        <Minus aria-hidden className="size-4" />
                      )}
                    </button>
                    <span className="w-6 text-center font-rotulo text-xl font-bold">
                      {l.cantidad}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-2 ring-1 ring-zinc-oscuro"
                      aria-label={`Una ${l.nombre} más`}
                      onClick={() => cambiar(l.id, 1)}
                    >
                      <Plus aria-hidden className="size-4" />
                    </button>
                    <span className="w-16 text-right font-semibold tabular-nums">
                      {euros(importeLinea(l))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="border-t border-zinc-oscuro/50 p-3">
            <p className="mb-3 flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-rotulo text-4xl font-bold">{euros(total)}</span>
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Boton disabled={!cesta.length} onClick={() => setCesta([])}>
                Vaciar
              </Boton>
              <Boton
                variante="exito"
                tamano="grande"
                disabled={!cesta.length || !puedeCobrar}
                onClick={() => setCobrando(true)}
              >
                {puedeCobrar ? "Cobrar" : "Cobra el encargado"}
              </Boton>
            </div>
          </footer>
        </section>
      </div>
      <Cobrar
        abierto={cobrando}
        lineas={lineas}
        descuento={0}
        comensales={1}
        permitirPartes={false}
        permitirPropina={propinas}
        alCerrar={() => setCobrando(false)}
        cobrar={async ({ pagos, propina, imprimir }, mensaje) => {
          const ok = await hacer(
            {
              tipo: "venta_rapida",
              lineas: cesta.map(({ productoId, cantidad, opciones, nota }) => ({
                productoId,
                cantidad,
                opciones,
                nota,
              })),
              pagos,
              propina,
              imprimir,
            },
            mensaje,
          );
          if (ok) {
            setCesta([]);
            if (enlaceResena) setCobrado(mensaje);
          }
          return ok;
        }}
      />
      <PedirResena
        abierto={cobrado !== null}
        detalle={cobrado ?? undefined}
        alCerrar={() => setCobrado(null)}
      />
    </main>
  );
}
