"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "exito";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-cobalto text-white hover:bg-cobalto-oscuro",
  secundario: "bg-white text-tinta ring-1 ring-zinc-oscuro hover:bg-zinc",
  peligro: "bg-aviso text-white hover:brightness-95",
  exito: "bg-cuenta text-white hover:brightness-95",
  fantasma: "text-tinta hover:bg-zinc",
};

export function Boton({
  variante = "secundario",
  tamano = "normal",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: "normal" | "grande" | "pequeno";
}) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        tamano === "grande"
          ? "h-14 px-5 text-lg"
          : tamano === "pequeno"
            ? "h-8 px-2.5 text-sm"
            : "h-11 px-4",
        VARIANTES[variante],
        className,
      )}
    />
  );
}

/** Ventana modal con <dialog>: atrapa el foco y se cierra con Escape. */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  children,
  ancho = "max-w-lg",
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && alCerrar()}
      aria-labelledby="titulo-dialogo"
      className={clsx(
        "m-auto w-[calc(100%-1.5rem)] rounded-2xl bg-white p-0 text-tinta shadow-2xl backdrop:bg-tinta/50",
        ancho,
      )}
    >
      {abierto && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-zinc px-5 py-3">
            <h2 id="titulo-dialogo" className="font-rotulo text-2xl font-bold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-lg p-2 hover:bg-zinc"
              aria-label="Cerrar"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-sm font-semibold">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tinta-suave">{ayuda}</span>}
    </label>
  );
}

export const claseEntrada =
  "h-11 w-full rounded-lg border border-zinc-oscuro bg-white px-3 text-base text-tinta placeholder:text-tinta-suave/70 focus:border-cobalto focus:outline-none";

export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
  ayuda,
}: {
  activo: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: string;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={activo}
        onChange={(e) => alCambiar(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-zinc-oscuro transition peer-checked:bg-cobalto peer-focus-visible:outline-3 peer-focus-visible:outline-cobalto after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
      />
      <span>
        <span className="block font-semibold">{etiqueta}</span>
        {ayuda && <span className="block text-sm text-tinta-suave">{ayuda}</span>}
      </span>
    </label>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-oscuro p-8 text-center">
      <p className="font-rotulo text-xl font-semibold">{titulo}</p>
      {children && <div className="mt-1 text-sm text-tinta-suave">{children}</div>}
    </div>
  );
}
