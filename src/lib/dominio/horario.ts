import { ZONA_HORARIA } from "../fechas";
import type { Horario } from "./tipos";

const formato = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA_HORARIA,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const NOMBRE_DIA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Día de la semana (0 domingo) y minuto del día, en hora de Madrid. */
function momento(iso: string) {
  const partes = Object.fromEntries(
    formato.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return {
    dia: DIAS.indexOf(partes.weekday ?? ""),
    minuto: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * ¿Está abierta la franja ahora? Sin horario, siempre. Si la franja cruza la medianoche (de 20:00
 * a 02:00), la madrugada cuenta como del día en que empezó.
 */
export function dentroDeHorario(horario: Horario | undefined, iso: string): boolean {
  if (!horario) return true;
  const { dia, minuto } = momento(iso);
  const desde = aMinutos(horario.desde);
  const hasta = aMinutos(horario.hasta);
  const diaVale = (d: number) => horario.dias.length === 0 || horario.dias.includes(d);
  if (desde <= hasta) return diaVale(dia) && minuto >= desde && minuto < hasta;
  if (minuto >= desde) return diaVale(dia);
  return minuto < hasta && diaVale((dia + 6) % 7);
}

/** «De 08:00 a 12:00, de lunes a viernes». */
export function describirHorario(h: Horario): string {
  const dias = [...h.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  let texto = `De ${h.desde} a ${h.hasta}`;
  if (dias.length && dias.length < 7) {
    const laborables = [1, 2, 3, 4, 5];
    if (dias.length === 5 && laborables.every((d) => dias.includes(d)))
      texto += ", de lunes a viernes";
    else if (dias.length === 2 && dias.includes(0) && dias.includes(6))
      texto += ", fines de semana";
    else texto += `, ${dias.map((d) => NOMBRE_DIA[d]!.toLowerCase()).join(", ")}`;
  }
  return texto;
}
