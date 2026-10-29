"use client";

import { Printer, Star } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { QrResena } from "@/components/qr-resena";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { enlaceDeResena, esEnlaceDirecto } from "@/lib/dominio/resenas";

/** Cuántos carteles caben en un A4 (2 × 2, para recortar y poner en las mesas o la barra). */
const CARTELES = 4;

/**
 * Reseñas: el enlace del bar, dónde sale (al cobrar, en la carta del QR y en el ticket) y los
 * carteles para las mesas.
 */
export function Resenas() {
  const { estado, hacer } = useDatos();
  const [texto, setTexto] = useState(estado.ajustes.enlaceResena ?? "");
  const enlace = enlaceDeResena(texto);
  const guardado = estado.ajustes.enlaceResena;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim() && !enlace) return;
    const { funciones: _f, ...ajustes } = estado.ajustes;
    void _f;
    await hacer(
      { tipo: "guardar_ajustes", ajustes: { ...ajustes, enlaceResena: enlace ?? "" } },
      enlace ? "Enlace guardado" : "Enlace quitado",
    );
  }

  return (
    <main>
      <div className="no-imprimir">
        <h1 className="mb-1 font-rotulo text-4xl font-bold">Reseñas</h1>
        <p className="mb-5 max-w-2xl text-tinta-suave">
          El QR lleva al cliente directo a poner las estrellas en tu ficha de Google. Sale en la
          pantalla del camarero al cobrar, en la carta del QR de la mesa después de pagar, al pie
          del ticket y en los carteles para las mesas.
        </p>

        <form
          onSubmit={guardar}
          className="mb-6 max-w-2xl rounded-2xl bg-white p-4 ring-1 ring-zinc"
        >
          <Campo
            etiqueta="Enlace para dejar una reseña"
            ayuda="El de «Pedir reseñas» de tu Perfil de Empresa de Google (empieza por https://g.page/r/…), o el identificador de tu ficha (Place ID, empieza por ChIJ…)."
          >
            <input
              className={claseEntrada}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="https://g.page/r/…/review"
            />
          </Campo>
          {texto.trim() && !enlace && (
            <p role="alert" className="mt-2 text-sm font-semibold text-aviso">
              Eso no parece un enlace (https://…) ni un identificador de ficha.
            </p>
          )}
          {enlace && !esEnlaceDirecto(enlace) && (
            <p className="mt-2 text-sm text-tinta-suave">
              Este enlace abre la ficha, no la ventana de las estrellas: funciona, pero con el de
              «Pedir reseñas» de Google es un paso menos para el cliente.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton type="submit" variante="primario" disabled={Boolean(texto.trim()) && !enlace}>
              Guardar
            </Boton>
            {enlace && (
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-lg px-4 font-semibold text-cobalto underline"
              >
                Probar el enlace
              </a>
            )}
          </div>
        </form>

        {guardado && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-rotulo text-2xl font-bold">Carteles para las mesas</h2>
            <Boton onClick={() => window.print()}>
              <Printer aria-hidden className="size-4" /> Imprimir ({CARTELES} por hoja)
            </Boton>
          </div>
        )}
      </div>

      {guardado && (
        <ul className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
          {Array.from({ length: CARTELES }, (_, i) => (
            <li
              key={i}
              className={
                i === 0
                  ? "break-inside-avoid rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-oscuro print:rounded-none print:ring-0 print:outline print:outline-1 print:outline-dashed"
                  : "hidden break-inside-avoid bg-white p-6 text-center print:block print:outline print:outline-1 print:outline-dashed"
              }
            >
              <p className="font-rotulo text-2xl font-bold">{estado.ajustes.nombreLocal}</p>
              <p className="mt-1 text-lg font-semibold">¿Qué tal todo?</p>
              <p className="mb-3 flex justify-center gap-1 text-ocupada" aria-hidden>
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} className="size-6 fill-current" />
                ))}
              </p>
              <QrResena enlace={guardado} className="mx-auto w-full max-w-48" />
              <p className="mt-3">Escanea y déjanos tu opinión en Google.</p>
              <p className="text-sm text-tinta-suave">¡Nos ayuda muchísimo!</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
