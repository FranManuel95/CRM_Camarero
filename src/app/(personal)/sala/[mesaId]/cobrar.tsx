"use client";

import clsx from "clsx";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada, Dialogo } from "@/components/ui";
import {
  calcularCambio,
  dividirEnPartes,
  euros,
  leerEuros,
  totalCuenta,
} from "@/lib/dominio/importes";
import type { Cuenta, MetodoPago, Pago } from "@/lib/dominio/tipos";

const BILLETES = [500, 1000, 2000, 5000];
const METODOS: { metodo: MetodoPago; texto: string; icono: typeof Banknote }[] = [
  { metodo: "efectivo", texto: "Efectivo", icono: Banknote },
  { metodo: "tarjeta", texto: "Tarjeta", icono: CreditCard },
  { metodo: "bizum", texto: "Bizum", icono: Smartphone },
];

/**
 * Cobro de una cuenta: efectivo con cálculo del cambio, tarjeta, Bizum o mezclado (parte con
 * tarjeta y parte en efectivo). El datáfono va aparte: aquí solo se apunta cómo se ha pagado.
 */
export function Cobrar({
  abierto,
  cuenta,
  alCerrar,
  alCobrar,
}: {
  abierto: boolean;
  cuenta: Cuenta;
  alCerrar: () => void;
  alCobrar: () => void;
}) {
  const { hacer } = useDatos();
  const total = totalCuenta(cuenta);
  const [metodo, setMetodo] = useState<MetodoPago | "mixto">("efectivo");
  const [entregado, setEntregado] = useState("");
  const [conTarjeta, setConTarjeta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entregadoCent = leerEuros(entregado) ?? 0;
  const tarjetaCent = Math.min(leerEuros(conTarjeta) ?? 0, total);
  const pagos: Pago[] =
    metodo === "efectivo"
      ? [{ metodo: "efectivo", importe: entregado ? entregadoCent : total }]
      : metodo === "mixto"
        ? [
            { metodo: "tarjeta", importe: tarjetaCent },
            { metodo: "efectivo", importe: entregado ? entregadoCent : total - tarjetaCent },
          ]
        : [{ metodo, importe: total }];
  const pagado = pagos.reduce((s, p) => s + p.importe, 0);
  const falta = Math.max(0, total - pagado);
  const cambio = calcularCambio(total, pagos);
  const partes = cuenta.comensales > 1 ? dividirEnPartes(total, cuenta.comensales) : null;

  async function cobrar() {
    setEnviando(true);
    const ok = await hacer(
      { tipo: "cobrar", cuentaId: cuenta.id, pagos },
      cambio ? `Cobrado. Cambio: ${euros(cambio)}` : "Cobrado",
    );
    setEnviando(false);
    if (ok) {
      alCerrar();
      alCobrar();
    }
  }

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Cobrar">
      <p className="text-center text-tinta-suave">Total a cobrar</p>
      <p className="mb-1 text-center font-rotulo text-6xl font-bold">{euros(total)}</p>
      {partes && (
        <p className="mb-4 text-center text-sm text-tinta-suave">
          Entre {cuenta.comensales}:{" "}
          {partes[0] === partes.at(-1)
            ? `${euros(partes[0]!)} cada uno`
            : `${euros(partes.at(-1)!)} – ${euros(partes[0]!)} cada uno`}
        </p>
      )}

      <div className="mb-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Forma de pago">
        {[...METODOS, { metodo: "mixto" as const, texto: "Mixto", icono: CreditCard }].map(
          ({ metodo: m, texto, icono: Icono }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={metodo === m}
              onClick={() => {
                setMetodo(m);
                setEntregado("");
              }}
              className={clsx(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold ring-1",
                metodo === m ? "bg-tinta text-white ring-tinta" : "bg-white ring-zinc-oscuro",
              )}
            >
              <Icono aria-hidden className="size-5" />
              {texto}
            </button>
          ),
        )}
      </div>

      {metodo === "mixto" && (
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Con tarjeta</span>
          <input
            inputMode="decimal"
            className={claseEntrada}
            value={conTarjeta}
            onChange={(e) => setConTarjeta(e.target.value)}
            placeholder="0,00"
          />
        </label>
      )}

      {(metodo === "efectivo" || metodo === "mixto") && (
        <div className="mb-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              Entrega en efectivo{" "}
              {metodo === "mixto" && tarjetaCent > 0 && `(resto: ${euros(total - tarjetaCent)})`}
            </span>
            <input
              inputMode="decimal"
              className={claseEntrada}
              value={entregado}
              onChange={(e) => setEntregado(e.target.value)}
              placeholder="Justo"
            />
          </label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <Boton tamano="pequeno" onClick={() => setEntregado("")}>
              Justo
            </Boton>
            {BILLETES.map((b) => (
              <Boton key={b} tamano="pequeno" onClick={() => setEntregado(String(b / 100))}>
                {b / 100} €
              </Boton>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 min-h-14 rounded-xl bg-zinc-claro p-3 text-center" aria-live="polite">
        {falta > 0 ? (
          <p className="font-semibold text-aviso">Faltan {euros(falta)}</p>
        ) : cambio > 0 ? (
          <p>
            Cambio: <span className="font-rotulo text-3xl font-bold">{euros(cambio)}</span>
          </p>
        ) : (
          <p className="text-tinta-suave">Pago justo</p>
        )}
      </div>
      <Boton
        variante="exito"
        tamano="grande"
        className="w-full"
        disabled={falta > 0 || enviando}
        onClick={cobrar}
      >
        Cobrar {euros(total)} y sacar ticket
      </Boton>
    </Dialogo>
  );
}
