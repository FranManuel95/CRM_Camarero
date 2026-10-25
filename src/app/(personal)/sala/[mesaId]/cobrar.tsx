"use client";

import clsx from "clsx";
import { Banknote, CreditCard, Minus, Plus, Smartphone } from "lucide-react";
import { useState } from "react";
import { Boton, claseEntrada, Dialogo } from "@/components/ui";
import {
  aplicarDescuento,
  calcularCambio,
  dividirEnPartes,
  euros,
  importeLinea,
  leerEuros,
  precioConOpciones,
} from "@/lib/dominio/importes";
import type { Centimos, LineaCuenta, MetodoPago, Pago } from "@/lib/dominio/tipos";

const BILLETES = [500, 1000, 2000, 5000];
const METODOS: { metodo: MetodoPago; texto: string; icono: typeof Banknote }[] = [
  { metodo: "efectivo", texto: "Efectivo", icono: Banknote },
  { metodo: "tarjeta", texto: "Tarjeta", icono: CreditCard },
  { metodo: "bizum", texto: "Bizum", icono: Smartphone },
];

export type DatosCobro = {
  pagos: Pago[];
  propina?: Centimos;
  /** Solo si se cobra una parte de la cuenta. */
  partes?: { lineaId: string; cantidad: number }[];
};

/**
 * Cobro: todo o solo algunos platos («yo pago lo mío»), con propina si la hay, en efectivo con
 * cálculo del cambio, tarjeta, Bizum o mezclado. El datáfono va aparte: aquí se apunta cómo se
 * ha pagado.
 */
export function Cobrar({
  abierto,
  lineas,
  descuento,
  comensales,
  alCerrar,
  cobrar,
  permitirPartes = true,
}: {
  abierto: boolean;
  /** Lo que queda por cobrar. */
  lineas: LineaCuenta[];
  descuento: number;
  comensales: number;
  alCerrar: () => void;
  cobrar: (datos: DatosCobro, mensajeOk: string) => Promise<boolean>;
  permitirPartes?: boolean;
}) {
  const [modo, setModo] = useState<"todo" | "platos">("todo");
  const [cuantas, setCuantas] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState<MetodoPago | "mixto">("efectivo");
  const [entregado, setEntregado] = useState("");
  const [conTarjeta, setConTarjeta] = useState("");
  const [propinaTexto, setPropinaTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const seleccion = modo === "todo" ? lineas : lineas.filter((l) => (cuantas[l.id] ?? 0) > 0);
  const subtotal = aplicarDescuento(
    modo === "todo"
      ? lineas.reduce((s, l) => s + importeLinea(l), 0)
      : seleccion.reduce(
          (s, l) => s + (l.invitacion ? 0 : precioConOpciones(l) * (cuantas[l.id] ?? 0)),
          0,
        ),
    descuento,
  );
  const propina = leerEuros(propinaTexto) ?? 0;
  const total = subtotal + propina;

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
  const partes = comensales > 1 && modo === "todo" ? dividirEnPartes(subtotal, comensales) : null;

  function reiniciar() {
    setModo("todo");
    setCuantas({});
    setEntregado("");
    setConTarjeta("");
    setPropinaTexto("");
  }

  async function confirmar() {
    setEnviando(true);
    const ok = await cobrar(
      {
        pagos,
        ...(propina ? { propina } : {}),
        ...(modo === "platos"
          ? { partes: seleccion.map((l) => ({ lineaId: l.id, cantidad: cuantas[l.id] ?? 0 })) }
          : {}),
      },
      cambio ? `Cobrado. Cambio: ${euros(cambio)}` : "Cobrado",
    );
    setEnviando(false);
    if (ok) {
      reiniciar();
      alCerrar();
    }
  }

  // Propinas de un toque: redondear al euro, 5 % y 10 %.
  const redondeo = Math.ceil(subtotal / 100) * 100 - subtotal;
  const atajosPropina = [
    { texto: "Sin propina", valor: 0 },
    ...(redondeo > 0 ? [{ texto: `Redondear (+${euros(redondeo)})`, valor: redondeo }] : []),
    { texto: "5 %", valor: Math.round(subtotal * 0.05) },
    { texto: "10 %", valor: Math.round(subtotal * 0.1) },
  ];

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Cobrar">
      {permitirPartes && lineas.reduce((n, l) => n + l.cantidad, 0) > 1 && (
        <div
          className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-claro p-1"
          role="radiogroup"
          aria-label="Qué se cobra"
        >
          {(["todo", "platos"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={clsx(
                "h-10 rounded-md font-semibold",
                modo === m ? "bg-white shadow" : "text-tinta-suave",
              )}
            >
              {m === "todo" ? "Toda la cuenta" : "Solo algunos platos"}
            </button>
          ))}
        </div>
      )}

      {modo === "platos" && (
        <ul className="mb-4 max-h-64 divide-y divide-zinc overflow-y-auto rounded-xl ring-1 ring-zinc">
          {lineas.map((l) => {
            const n = cuantas[l.id] ?? 0;
            const poner = (v: number) =>
              setCuantas((c) => ({ ...c, [l.id]: Math.max(0, Math.min(l.cantidad, v)) }));
            return (
              <li
                key={l.id}
                className={clsx("flex items-center gap-2 px-3 py-2", n > 0 && "bg-cuenta-claro")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.nombre}</span>
                  <span className="text-xs text-tinta-suave">
                    {l.cantidad} en la cuenta · {euros(l.invitacion ? 0 : precioConOpciones(l))} c/u
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded-lg p-2 ring-1 ring-zinc-oscuro"
                  aria-label={`Una ${l.nombre} menos`}
                  onClick={() => poner(n - 1)}
                >
                  <Minus aria-hidden className="size-4" />
                </button>
                <span className="w-6 text-center font-rotulo text-xl font-bold">{n}</span>
                <button
                  type="button"
                  className="rounded-lg p-2 ring-1 ring-zinc-oscuro"
                  aria-label={`Una ${l.nombre} más`}
                  onClick={() => poner(n + 1)}
                >
                  <Plus aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-tinta-suave">
        {modo === "platos" ? "Lo elegido" : "Total a cobrar"}
      </p>
      <p className="mb-1 text-center font-rotulo text-6xl font-bold">{euros(total)}</p>
      {propina > 0 && (
        <p className="text-center text-sm text-tinta-suave">
          {euros(subtotal)} + {euros(propina)} de propina
        </p>
      )}
      {partes && (
        <p className="mb-2 text-center text-sm text-tinta-suave">
          Entre {comensales}:{" "}
          {partes[0] === partes.at(-1)
            ? `${euros(partes[0]!)} cada uno`
            : `${euros(partes.at(-1)!)} – ${euros(partes[0]!)} cada uno`}
        </p>
      )}

      <div
        className="mt-3 mb-4 grid grid-cols-4 gap-2"
        role="radiogroup"
        aria-label="Forma de pago"
      >
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

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-semibold">Propina</legend>
        <div className="flex flex-wrap gap-2">
          {atajosPropina.map((a) => (
            <Boton
              key={a.texto}
              tamano="pequeno"
              variante={
                propina === a.valor && (a.valor > 0 || !propinaTexto) ? "primario" : "secundario"
              }
              onClick={() =>
                setPropinaTexto(a.valor ? (a.valor / 100).toFixed(2).replace(".", ",") : "")
              }
            >
              {a.texto}
            </Boton>
          ))}
          <input
            inputMode="decimal"
            aria-label="Otra propina"
            placeholder="Otra"
            className={clsx(claseEntrada, "h-8 w-24")}
            value={propinaTexto}
            onChange={(e) => setPropinaTexto(e.target.value)}
          />
        </div>
      </fieldset>

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
        disabled={falta > 0 || enviando || (modo === "platos" && seleccion.length === 0)}
        onClick={confirmar}
      >
        Cobrar {euros(total)} y sacar ticket
      </Boton>
    </Dialogo>
  );
}
