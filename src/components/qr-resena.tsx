"use client";

import { renderSVG } from "uqr";
import { Dialogo, Boton } from "@/components/ui";
import { useDatos, useFuncion } from "@/components/datos-personal";

/** El QR de la reseña (un SVG que se ve nítido en pantalla y en papel). */
export function QrResena({ enlace, className }: { enlace: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label="QR para dejar una reseña"
      className={className}
      dangerouslySetInnerHTML={{ __html: renderSVG(enlace, { border: 1 }) }}
    />
  );
}

/** El enlace de reseña del bar, si la función está encendida y hay enlace. */
export function useEnlaceResena(): string | null {
  const { estado } = useDatos();
  const encendida = useFuncion("resenas");
  return (encendida && estado.ajustes.enlaceResena) || null;
}

/**
 * Después de cobrar: el QR de la reseña en grande en la pantalla del camarero, para que el
 * cliente lo escanee con su móvil en ese mismo momento.
 */
export function PedirResena({
  abierto,
  alCerrar,
  titulo = "Cobrado",
  detalle,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo?: string;
  detalle?: string;
}) {
  const enlace = useEnlaceResena();
  if (!enlace) return null;
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo}>
      {detalle && <p className="mb-2 text-center text-lg font-semibold">{detalle}</p>}
      <p className="mb-3 text-center">
        ¿Les ha gustado? Que escaneen el QR: les lleva directo a dejar las estrellas.
      </p>
      <QrResena enlace={enlace} className="mx-auto w-full max-w-64" />
      <Boton variante="primario" tamano="grande" className="mt-4 w-full" onClick={alCerrar}>
        Hecho
      </Boton>
    </Dialogo>
  );
}
