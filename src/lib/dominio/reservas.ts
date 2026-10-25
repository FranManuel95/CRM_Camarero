import { diaLocal } from "../fechas";
import { instante } from "./equipo";
import type { Reserva } from "./tipos";

/** Desde cuánto antes de la hora se ve la reserva en la mesa, y cuánto se espera después. */
export const MINUTOS_ANTES = 120;
export const MINUTOS_DESPUES = 45;

/** Las que siguen en pie (ni sentadas, ni canceladas, ni de quien no vino). */
export const pendiente = (r: Reserva) => r.estado === "confirmada" || r.estado === "por_confirmar";

/** Las reservas de un día, por hora. */
export function reservasDelDia(reservas: Reserva[], dia: string): Reserva[] {
  return reservas.filter((r) => r.dia === dia).sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * La reserva que toca a una mesa ahora: confirmada, de hoy y entre dos horas antes y tres
 * cuartos de hora después de su hora. Así se ve en el plano y al abrir la mesa.
 */
export function reservaCercana(reservas: Reserva[], mesaId: string, ahora: string) {
  const hoy = diaLocal(ahora);
  const t = Date.parse(ahora);
  return reservasDelDia(reservas, hoy).find((r) => {
    if (r.mesaId !== mesaId || r.estado !== "confirmada") return false;
    const hora = Date.parse(instante(r.dia, r.hora));
    return hora - MINUTOS_ANTES * 60_000 <= t && t <= hora + MINUTOS_DESPUES * 60_000;
  });
}
