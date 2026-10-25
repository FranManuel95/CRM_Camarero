"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { renderSVG } from "uqr";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { useDelNavegador } from "@/lib/cliente/use-guardado";

/** Hoja con un QR por mesa para imprimir en A4, recortar y poner en un portacartas. */
export function HojaQR({ urlPublica }: { urlPublica: string }) {
  const { estado } = useDatos();
  const origen = useDelNavegador(() => window.location.origin, "");
  const [editada, setBase] = useState<string | null>(null);
  const base = editada ?? (urlPublica || origen);
  const local = /localhost|127\.0\.0\.1/.test(base);
  const zonas = [...estado.zonas].sort((a, b) => a.orden - b.orden);

  return (
    <main>
      <div className="no-imprimir mb-4 space-y-3">
        <h1 className="font-rotulo text-4xl font-bold">QR de las mesas</h1>
        <Campo
          etiqueta="Dirección que abren los móviles de los clientes"
          ayuda="La del ordenador de la caja en la wifi del local (por ejemplo http://192.168.1.50:3000) o tu dominio si está en internet."
        >
          <input
            className={claseEntrada}
            value={base}
            onChange={(e) => setBase(e.target.value.replace(/\/$/, ""))}
          />
        </Campo>
        {local && (
          <p className="rounded-lg bg-aviso-claro p-3 text-sm font-semibold">
            «localhost» solo funciona en este ordenador: los móviles de los clientes no podrán
            abrirla. Pon la IP del ordenador en la wifi del local.
          </p>
        )}
        <Boton variante="primario" onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" /> Imprimir hoja
        </Boton>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {zonas.flatMap((z) =>
          estado.mesas
            .filter((m) => m.zonaId === z.id)
            .map((m) => {
              const url = `${base}/m/${estado.local}/${m.token}`;
              return (
                <li
                  key={m.id}
                  className="break-inside-avoid rounded-2xl bg-white p-4 text-center ring-1 ring-zinc-oscuro"
                >
                  <p className="font-rotulo text-xl font-bold">{estado.ajustes.nombreLocal}</p>
                  <div
                    className="mx-auto my-2 w-full max-w-44"
                    dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1 }) }}
                  />
                  <p className="font-rotulo text-3xl font-bold">{m.nombre}</p>
                  <p className="text-sm">Escanea para ver la carta y pedir</p>
                  <a
                    href={url}
                    className="no-imprimir mt-1 inline-flex min-h-10 items-center px-2 text-sm text-cobalto underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Probar
                  </a>
                </li>
              );
            }),
        )}
      </ul>
    </main>
  );
}
