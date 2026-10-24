import clsx from "clsx";
import { renderSVG } from "uqr";
import { type Bloque, alinear, lineaPar, partirTexto } from "@/lib/impresion/documento";

/**
 * El documento de impresión dibujado como un ticket de papel térmico: letra de ancho fijo y las
 * mismas columnas que la impresora, para que la vista previa sea fiel a lo que sale.
 */
export function Papel({
  documento,
  columnas = 48,
  className,
}: {
  documento: Bloque[];
  columnas?: number;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "bg-white p-[3mm] font-mono text-[12px] leading-[1.35] text-black",
        className,
      )}
      style={{ width: `calc(${columnas}ch + 6mm)` }}
    >
      {documento.map((b, i) => {
        switch (b.tipo) {
          case "texto": {
            const ancho = b.grande ? Math.floor(columnas / 2) : columnas;
            return (
              <div
                key={i}
                className={clsx(
                  b.negrita && "font-bold",
                  b.grande && "origin-left text-[24px] leading-[1.2]",
                )}
              >
                {partirTexto(b.texto, ancho).map((l, j) => (
                  <pre key={j} className="whitespace-pre">
                    {alinear(l, ancho, b.alinear) || " "}
                  </pre>
                ))}
              </div>
            );
          }
          case "par":
            return (
              <div key={i} className={clsx(b.negrita && "font-bold")}>
                {lineaPar(b.izquierda, b.derecha, columnas).map((l, j) => (
                  <pre key={j} className="whitespace-pre">
                    {l}
                  </pre>
                ))}
              </div>
            );
          case "separador":
            return (
              <pre key={i} className="whitespace-pre">
                {(b.caracter ?? "-").repeat(columnas)}
              </pre>
            );
          case "espacio":
            return <div key={i} style={{ height: `${1.35 * (b.lineas ?? 1)}em` }} />;
          case "qr":
            return (
              <div
                key={i}
                className="mx-auto my-1 size-32"
                // SVG generado aquí mismo a partir de un texto nuestro.
                dangerouslySetInnerHTML={{ __html: renderSVG(b.datos, { border: 1 }) }}
              />
            );
          case "corte":
            return (
              <div
                key={i}
                className="no-imprimir my-2 border-t-2 border-dashed border-zinc-oscuro"
                aria-hidden
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
