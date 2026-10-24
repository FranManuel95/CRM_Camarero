import { euros } from "@/lib/dominio/importes";

/**
 * Barras verticales de una sola serie (ventas por día o por hora). Cada barra lleva su valor en
 * el título para el ratón y el lector de pantalla; la tabla con los números está al lado.
 */
export function Barras({
  datos,
  alto = 160,
  titulo,
}: {
  datos: { etiqueta: string; valor: number; detalle?: string }[];
  alto?: number;
  titulo: string;
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const marcaEtiqueta = Math.max(1, Math.ceil(datos.length / 8));
  return (
    <figure>
      <figcaption className="sr-only">{titulo}</figcaption>
      <div
        className="flex items-end gap-0.5 border-b border-zinc-oscuro"
        style={{ height: alto }}
        role="list"
      >
        {datos.map((d, i) => (
          <div
            key={i}
            role="listitem"
            className="group relative flex h-full flex-1 items-end"
            aria-label={`${d.etiqueta}: ${euros(d.valor)}`}
          >
            <div
              className="w-full rounded-t-[4px] bg-cobalto transition group-hover:bg-cobalto-oscuro"
              style={{ height: `${Math.max(d.valor > 0 ? 2 : 0, (d.valor / maximo) * 100)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-tinta px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
              {d.etiqueta}: <b>{euros(d.valor)}</b>
              {d.detalle && <span className="block text-zinc">{d.detalle}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[11px] text-tinta-suave" aria-hidden>
        {datos.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center">
            {i % marcaEtiqueta === 0 ? d.etiqueta : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
