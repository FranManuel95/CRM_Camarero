import { estadoDeEjemplo } from "./demo";
import { resumenPin } from "./pin";
import type { Contexto } from "./reducir";
import type { Estado } from "./tipos";

export type DatosBarNuevo = {
  nombre: string;
  encargado: string;
  pin: string;
  /** true: empieza con la carta de ejemplo para cambiarla; false: carta vacía. */
  conCartaDeEjemplo: boolean;
};

/**
 * El estado inicial de un bar que se acaba de dar de alta: el plano y (si quiere) la carta del
 * ejemplo para tener algo que tocar, un solo encargado y los datos del ticket por rellenar.
 */
export function estadoNuevo(ctx: Contexto, datos: DatosBarNuevo): Estado {
  const base = estadoDeEjemplo(ctx);
  return {
    ...base,
    ajustes: {
      ...base.ajustes,
      nombreLocal: datos.nombre,
      razonSocial: "",
      nif: "",
      direccion: "",
      telefono: "",
      pieTicket: "¡Gracias por tu visita!",
    },
    empleados: [
      {
        id: ctx.nuevoId(),
        nombre: datos.encargado,
        pin: resumenPin(datos.pin),
        rol: "encargado",
        activo: true,
      },
    ],
    categorias: datos.conCartaDeEjemplo
      ? base.categorias
      : [
          { id: "cat-1", nombre: "Bebidas", orden: 0, destino: "barra", visibleEnQR: true },
          { id: "cat-2", nombre: "Comida", orden: 1, destino: "cocina", visibleEnQR: true },
        ],
    // La carta de ejemplo sin el stock: las existencias de un bar de mentira no le sirven.
    productos: datos.conCartaDeEjemplo
      ? base.productos.map(({ receta: _receta, ...p }) => (void _receta, p))
      : [],
    ingredientes: [],
    movimientosStock: [],
    cuentas: [],
    tickets: [],
    gastos: [],
    turnos: [],
    avisos: [],
    trabajos: [],
    vinculos: [],
  };
}
