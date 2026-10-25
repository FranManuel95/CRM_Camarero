import { calcularCambio } from "./importes";
import type { Centimos, Estado, MetodoPago, Ticket, TurnoCaja } from "./tipos";

export function turnoAbierto(estado: Pick<Estado, "turnos">): TurnoCaja | undefined {
  return estado.turnos.find((t) => t.cerradoEn === null);
}

export function ticketsDelTurno(estado: Pick<Estado, "tickets">, turno: TurnoCaja): Ticket[] {
  const fin = turno.cerradoEn ?? "9999";
  return estado.tickets.filter((t) => t.fecha >= turno.abiertoEn && t.fecha <= fin);
}

export type ResumenTurno = {
  tickets: number;
  ventas: Centimos;
  propinas: Centimos;
  porMetodo: Record<MetodoPago, Centimos>;
  entradas: Centimos;
  salidas: Centimos;
  /** Lo que debería haber en el cajón: fondo + efectivo cobrado + entradas − salidas. */
  efectivoEsperado: Centimos;
  /** Contado − esperado. Negativo = falta dinero. Null si aún no se ha contado. */
  descuadre: Centimos | null;
  desglose: { tipo: number; base: Centimos; cuota: Centimos; total: Centimos }[];
};

export function resumenTurno(estado: Pick<Estado, "tickets">, turno: TurnoCaja): ResumenTurno {
  const tickets = ticketsDelTurno(estado, turno);
  const porMetodo: Record<MetodoPago, Centimos> = { efectivo: 0, tarjeta: 0, bizum: 0, otro: 0 };
  const iva = new Map<number, { base: Centimos; cuota: Centimos; total: Centimos }>();
  let ventas = 0;
  let propinas = 0;
  for (const t of tickets) {
    ventas += t.total;
    propinas += t.propina ?? 0;
    // Al efectivo entregado se le quita el cambio devuelto: lo que de verdad se queda en caja.
    const cambio = t.cambio ?? calcularCambio(t.total, t.pagos);
    for (const p of t.pagos) porMetodo[p.metodo] += p.importe;
    porMetodo.efectivo -= cambio;
    for (const d of t.desglose) {
      const previo = iva.get(d.tipo) ?? { base: 0, cuota: 0, total: 0 };
      iva.set(d.tipo, {
        base: previo.base + d.base,
        cuota: previo.cuota + d.cuota,
        total: previo.total + d.total,
      });
    }
  }
  const entradas = turno.movimientos
    .filter((m) => m.tipo === "entrada")
    .reduce((s, m) => s + m.importe, 0);
  const salidas = turno.movimientos
    .filter((m) => m.tipo === "salida")
    .reduce((s, m) => s + m.importe, 0);
  const efectivoEsperado = turno.fondoInicial + porMetodo.efectivo + entradas - salidas;
  return {
    tickets: tickets.length,
    ventas,
    /** Propinas cobradas (van en los pagos y en la caja, pero no son ventas). */
    propinas,
    porMetodo,
    entradas,
    salidas,
    efectivoEsperado,
    descuadre: turno.efectivoContado === null ? null : turno.efectivoContado - efectivoEsperado,
    desglose: [...iva.entries()].sort(([a], [b]) => a - b).map(([tipo, v]) => ({ tipo, ...v })),
  };
}
