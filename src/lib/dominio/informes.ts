import { diaLocal, horaLocal } from "../fechas";
import { calcularCambio } from "./importes";
import type { CategoriaGasto, Centimos, Estado, MetodoPago } from "./tipos";

export type Rango = { desde: string; hasta: string };

/** Base imponible de un importe con IVA incluido. */
const base = (importe: Centimos, iva: number) => Math.round(importe / (1 + iva / 100));

/**
 * Números del negocio en un rango de fechas (ISO, `hasta` excluido): ventas, gastos, IVA y
 * resultado. El «resultado» es ventas sin IVA menos gastos sin IVA: lo que queda antes de
 * impuestos sobre beneficios. Es orientativo, no sustituye a la contabilidad de la gestoría.
 */
export function informe(
  estado: Pick<Estado, "tickets" | "gastos" | "productos" | "empleados">,
  rango: Rango,
) {
  const tickets = estado.tickets.filter((t) => t.fecha >= rango.desde && t.fecha < rango.hasta);
  const gastos = estado.gastos.filter((g) => g.fecha >= rango.desde && g.fecha < rango.hasta);

  const porDia = new Map<string, { ventas: Centimos; tickets: number; gastos: Centimos }>();
  const dia = (clave: string) => {
    const d = porDia.get(clave) ?? { ventas: 0, tickets: 0, gastos: 0 };
    porDia.set(clave, d);
    return d;
  };
  const porHora = Array.from({ length: 24 }, () => 0);
  const porMetodo: Record<MetodoPago, Centimos> = { efectivo: 0, tarjeta: 0, bizum: 0, otro: 0 };
  const porEmpleado = new Map<string, { ventas: Centimos; tickets: number }>();
  const porProducto = new Map<string, { unidades: number; ventas: Centimos }>();
  let ventas = 0;
  let ventasBase = 0;
  let ivaRepercutido = 0;
  let devoluciones = 0;

  for (const t of tickets) {
    ventas += t.total;
    if (t.total < 0) devoluciones += -t.total;
    for (const d of t.desglose) {
      ventasBase += d.base;
      ivaRepercutido += d.cuota;
    }
    const d = dia(diaLocal(t.fecha));
    d.ventas += t.total;
    if (!t.rectificaA) d.tickets += 1;
    porHora[horaLocal(t.fecha)]! += t.total;
    const cambio = t.cambio ?? calcularCambio(t.total, t.pagos);
    for (const p of t.pagos) porMetodo[p.metodo] += p.importe;
    porMetodo.efectivo -= cambio;
    const e = porEmpleado.get(t.empleadoId ?? "") ?? { ventas: 0, tickets: 0 };
    e.ventas += t.total;
    if (!t.rectificaA) e.tickets += 1;
    porEmpleado.set(t.empleadoId ?? "", e);
    for (const l of t.lineas) {
      const nombre = l.producto;
      const p = porProducto.get(nombre) ?? { unidades: 0, ventas: 0 };
      p.unidades += l.cantidad;
      p.ventas += l.importe;
      porProducto.set(nombre, p);
    }
  }

  const porCategoriaGasto = new Map<CategoriaGasto, Centimos>();
  let totalGastos = 0;
  let gastosBase = 0;
  let ivaSoportado = 0;
  for (const g of gastos) {
    totalGastos += g.importe;
    const b = base(g.importe, g.iva);
    gastosBase += b;
    ivaSoportado += g.importe - b;
    porCategoriaGasto.set(g.categoria, (porCategoriaGasto.get(g.categoria) ?? 0) + g.importe);
    dia(diaLocal(g.fecha)).gastos += g.importe;
  }

  const costes = new Map(estado.productos.map((p) => [p.nombre, p.coste]));
  const productos = [...porProducto.entries()]
    .map(([nombre, p]) => {
      const coste = costes.get(nombre);
      return { nombre, ...p, coste: coste === undefined ? null : coste * p.unidades };
    })
    .sort((a, b) => b.ventas - a.ventas);

  const numTickets = tickets.filter((t) => !t.rectificaA).length;
  return {
    ventas,
    ventasBase,
    ivaRepercutido,
    devoluciones,
    tickets: numTickets,
    ticketMedio: numTickets ? Math.round(ventas / numTickets) : 0,
    gastos: totalGastos,
    gastosBase,
    ivaSoportado,
    resultado: ventasBase - gastosBase,
    /** IVA a pagar (repercutido − soportado) del periodo, orientativo para el modelo 303. */
    ivaAPagar: ivaRepercutido - ivaSoportado,
    porDia: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, d]) => ({ fecha, ...d })),
    porHora,
    porMetodo,
    porEmpleado: [...porEmpleado.entries()]
      .map(([id, e]) => ({
        id,
        nombre: estado.empleados.find((x) => x.id === id)?.nombre ?? "—",
        ...e,
      }))
      .sort((a, b) => b.ventas - a.ventas),
    productos,
    porCategoriaGasto: [...porCategoriaGasto.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** Rango de un día completo en hora de Madrid, a partir de «AAAA-MM-DD». */
export function rangoDeDias(desde: string, hasta: string): Rango {
  return { desde: inicioDelDia(desde), hasta: inicioDelDia(sumarDias(hasta, 1)) };
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Medianoche en Madrid de ese día, en ISO UTC (tiene en cuenta el horario de verano). */
export function inicioDelDia(fecha: string): string {
  const mediodia = new Date(`${fecha}T12:00:00Z`);
  const horaMadrid = horaLocal(mediodia.toISOString());
  const desfase = horaMadrid - 12;
  return new Date(Date.parse(`${fecha}T00:00:00Z`) - desfase * 3_600_000).toISOString();
}
