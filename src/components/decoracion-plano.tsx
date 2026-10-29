import clsx from "clsx";
import { ChefHat, DoorOpen, Leaf, type LucideIcon } from "lucide-react";
import type { Decoracion, TipoDecoracion } from "@/lib/dominio/tipos";

/** Cómo se llama cada cosa, su tamaño al añadirla y cómo se dibuja. */
export const TIPOS_DECORACION: Record<
  TipoDecoracion,
  {
    nombre: string;
    ancho: number;
    alto: number;
    clase: string;
    icono?: LucideIcon;
    /** Texto que lleva al añadirla. */
    texto?: string;
  }
> = {
  mostrador: {
    nombre: "Mostrador",
    ancho: 40,
    alto: 6,
    clase: "rounded-lg bg-[#7a5134] text-white",
    texto: "Barra",
  },
  pared: { nombre: "Pared", ancho: 30, alto: 1.5, clase: "bg-tinta" },
  puerta: {
    nombre: "Puerta",
    ancho: 10,
    alto: 2.5,
    clase: "rounded-sm border-2 border-dashed border-tinta bg-white text-tinta",
    icono: DoorOpen,
  },
  ventana: {
    nombre: "Ventana",
    ancho: 14,
    alto: 1.5,
    clase: "border-y-2 border-[#3f86c4] bg-[#cfe6f7]",
  },
  planta: {
    nombre: "Planta",
    ancho: 5,
    alto: 5,
    clase: "rounded-full bg-[#cfe8c8] text-[#2f6b2a]",
    icono: Leaf,
  },
  columna: { nombre: "Columna", ancho: 4, alto: 4, clase: "rounded-sm bg-zinc-oscuro" },
  aseos: {
    nombre: "Aseos",
    ancho: 12,
    alto: 10,
    clase: "rounded-lg bg-white/70 text-tinta ring-1 ring-zinc-oscuro",
    texto: "Aseos",
  },
  cocina: {
    nombre: "Cocina",
    ancho: 20,
    alto: 14,
    clase: "rounded-lg bg-white/70 text-tinta ring-1 ring-zinc-oscuro",
    icono: ChefHat,
    texto: "Cocina",
  },
  texto: { nombre: "Rótulo", ancho: 14, alto: 4, clase: "text-tinta", texto: "Entrada" },
};

export const LISTA_DECORACIONES = Object.keys(TIPOS_DECORACION) as TipoDecoracion[];

/** Posición en el plano, con la misma cuenta que las mesas (alto × 1,6 por la proporción). */
export const estiloEnPlano = (d: Pick<Decoracion, "x" | "y" | "ancho" | "alto">) => ({
  left: `${d.x}%`,
  top: `${d.y}%`,
  width: `${d.ancho}%`,
  height: `${d.alto * 1.6}%`,
});

/** El dibujo de una decoración (sin posición: la pone quien lo usa). */
export function DibujoDecoracion({
  decoracion,
  className,
}: {
  decoracion: Pick<Decoracion, "tipo" | "texto" | "ancho" | "alto">;
  className?: string;
}) {
  const tipo = TIPOS_DECORACION[decoracion.tipo];
  const Icono = tipo.icono;
  const vertical = decoracion.alto * 1.6 > decoracion.ancho * 1.2;
  return (
    <span
      className={clsx(
        "flex size-full items-center justify-center gap-1 overflow-hidden text-xs leading-none font-semibold sm:text-sm",
        vertical && "flex-col",
        tipo.clase,
        className,
      )}
    >
      {Icono && <Icono aria-hidden className="size-4 shrink-0" />}
      {decoracion.texto && (
        <span
          className={clsx(
            "truncate",
            vertical && decoracion.ancho < 8 && "[writing-mode:vertical-rl]",
          )}
        >
          {decoracion.texto}
        </span>
      )}
    </span>
  );
}

/** Las decoraciones de una zona, debajo de las mesas y sin tocarse (solo de referencia). */
export function DecoracionesPlano({ decoraciones }: { decoraciones: Decoracion[] }) {
  return (
    <>
      {decoraciones.map((d) => (
        <div
          key={d.id}
          aria-hidden
          className="pointer-events-none absolute"
          style={estiloEnPlano(d)}
        >
          <DibujoDecoracion decoracion={d} />
        </div>
      ))}
    </>
  );
}
