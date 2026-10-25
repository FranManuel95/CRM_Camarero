import { diaLocal, formatearHora, horaLocal } from "../fechas";
import type { Rango } from "./informes";
import { sumarDias } from "./informes";
import type { Centimos, Empleado, Estado, Fichaje, TurnoCuadrante } from "./tipos";

/**
 * Equipo: fichajes (registro de jornada), cuadrante de turnos e informe por camarero. Todo en
 * hora de Madrid.
 */

/** Una entrada sin salida de hace más de esto se da por olvidada: se puede volver a entrar. */
export const HORAS_JORNADA_OLVIDADA = 16;

export type Situacion = "fuera" | "trabajando" | "descanso";

/** La jornada que tiene abierta una persona ahora mismo (si la tiene). */
export function jornadaAbierta(
  fichajes: Fichaje[],
  empleadoId: string,
  ahora: string,
): Fichaje | undefined {
  const limite = Date.parse(ahora) - HORAS_JORNADA_OLVIDADA * 3_600_000;
  return fichajes
    .filter((f) => f.empleadoId === empleadoId && !f.salida && Date.parse(f.entrada) > limite)
    .sort((a, b) => b.entrada.localeCompare(a.entrada))[0];
}

export function situacion(fichajes: Fichaje[], empleadoId: string, ahora: string) {
  const fichaje = jornadaAbierta(fichajes, empleadoId, ahora);
  const s: Situacion = !fichaje
    ? "fuera"
    : fichaje.pausas.some((p) => !p.fin)
      ? "descanso"
      : "trabajando";
  return { situacion: s, fichaje };
}

/** Minutos trabajados de un fichaje (sin los descansos). Si sigue abierto, hasta `ahora`. */
export function minutosTrabajados(f: Fichaje, ahora: string): number {
  const fin = Date.parse(f.salida ?? ahora);
  const total = fin - Date.parse(f.entrada);
  const pausas = f.pausas.reduce(
    (s, p) => s + Math.max(0, Math.min(fin, Date.parse(p.fin ?? ahora)) - Date.parse(p.inicio)),
    0,
  );
  return Math.max(0, Math.round((total - pausas) / 60_000));
}

export function minutosDePausa(f: Fichaje, ahora: string): number {
  return f.pausas.reduce(
    (s, p) =>
      s + Math.max(0, Math.round((Date.parse(p.fin ?? ahora) - Date.parse(p.inicio)) / 60_000)),
    0,
  );
}

/** «7 h 30 min», «45 min». */
export function formatearMinutos(minutos: number): string {
  const signo = minutos < 0 ? "−" : "";
  const m = Math.abs(Math.round(minutos));
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (!h) return `${signo}${resto} min`;
  return resto ? `${signo}${h} h ${resto} min` : `${signo}${h} h`;
}

/** Entradas sin salida que ya se han quedado viejas: alguien se olvidó de fichar. */
export function sinSalida(fichajes: Fichaje[], ahora: string): Fichaje[] {
  const limite = Date.parse(ahora) - HORAS_JORNADA_OLVIDADA * 3_600_000;
  return fichajes.filter((f) => !f.salida && Date.parse(f.entrada) <= limite);
}

/** El instante (ISO UTC) de un día y una hora de Madrid: «2026-10-27», «12:30». */
export function instante(dia: string, hora: string): string {
  const supuesto = Date.parse(`${dia}T${hora}:00Z`);
  const desfase =
    (horaLocal(new Date(supuesto).toISOString()) - new Date(supuesto).getUTCHours() + 24) % 24;
  return new Date(supuesto - desfase * 3_600_000).toISOString();
}

/** «12:30» en hora de Madrid. */
export const horaDe = (iso: string) => formatearHora(iso);

/** El lunes de la semana de un día («2026-10-29» → «2026-10-26»). */
export function lunesDe(dia: string): string {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return sumarDias(dia, -((semana + 6) % 7));
}

export const diasDeSemana = (lunes: string) =>
  Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

/** Minutos de un turno del cuadrante (si acaba antes de empezar, cruza la medianoche). */
export function minutosTurno(t: Pick<TurnoCuadrante, "desde" | "hasta">): number {
  const a = minutoDelDia(t.desde);
  const b = minutoDelDia(t.hasta);
  return b > a ? b - a : b + 1440 - a;
}

const minutoDelDia = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function turnosDe(cuadrante: TurnoCuadrante[], empleadoId: string, dia: string) {
  return cuadrante
    .filter((t) => t.empleadoId === empleadoId && t.dia === dia)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

export type ResumenPersona = {
  empleado: Empleado;
  /** Días con fichaje. */
  dias: number;
  trabajados: number;
  previstos: number;
  /** Fichajes sin salida (no cuentan en las horas). */
  abiertos: number;
};

/** Horas fichadas frente a las previstas en el cuadrante, por persona, entre dos días. */
export function resumenJornada(
  estado: Pick<Estado, "empleados" | "fichajes" | "cuadrante">,
  desde: string,
  hasta: string,
  ahora: string,
): ResumenPersona[] {
  const dentro = (dia: string) => dia >= desde && dia <= hasta;
  return estado.empleados
    .map((empleado) => {
      const suyos = estado.fichajes.filter(
        (f) => f.empleadoId === empleado.id && dentro(diaLocal(f.entrada)),
      );
      const cerrados = suyos.filter((f) => f.salida);
      return {
        empleado,
        dias: new Set(suyos.map((f) => diaLocal(f.entrada))).size,
        trabajados: cerrados.reduce((s, f) => s + minutosTrabajados(f, ahora), 0),
        previstos: estado.cuadrante
          .filter((t) => t.empleadoId === empleado.id && dentro(t.dia))
          .reduce((s, t) => s + minutosTurno(t), 0),
        abiertos: suyos.length - cerrados.length,
      };
    })
    .filter((r) => r.empleado.activo || r.dias > 0);
}

/**
 * Registro de jornada en CSV, para la gestoría o la Inspección: una fila por fichaje, con las
 * correcciones a la vista.
 */
export function filasRegistro(
  fichajes: Fichaje[],
  empleados: Pick<Empleado, "id" | "nombre">[],
  ahora: string,
): (string | number | null)[][] {
  const nombre = (id: string) => empleados.find((e) => e.id === id)?.nombre ?? "—";
  return [
    ["Persona", "Día", "Entrada", "Salida", "Descansos (min)", "Horas trabajadas", "Correcciones"],
    ...[...fichajes]
      .sort((a, b) => a.entrada.localeCompare(b.entrada))
      .map((f) => [
        nombre(f.empleadoId),
        diaLocal(f.entrada),
        horaDe(f.entrada),
        f.salida
          ? `${horaDe(f.salida)}${diaLocal(f.salida) !== diaLocal(f.entrada) ? ` (${diaLocal(f.salida)})` : ""}`
          : "Sin salida",
        minutosDePausa(f, f.salida ?? ahora),
        f.salida ? Number((minutosTrabajados(f, ahora) / 60).toFixed(2)) : null,
        (f.cambios ?? [])
          .map((c) => `${diaLocal(c.en)} ${horaDe(c.en)} ${nombre(c.por)}: ${c.motivo}`)
          .join(" | "),
      ]),
  ];
}

export type FilaCamarero = {
  empleado: Pick<Empleado, "id" | "nombre">;
  ventas: Centimos;
  tickets: number;
  propinas: Centimos;
  anulaciones: number;
  importeAnulado: Centimos;
  invitaciones: number;
  importeInvitado: Centimos;
  /** Minutos fichados (jornadas cerradas) en el rango. */
  minutos: number;
};

/** Ventas, propinas, anulaciones, invitaciones y horas de cada persona en un rango. */
export function informePorCamarero(
  estado: Pick<Estado, "empleados" | "tickets" | "incidencias" | "fichajes">,
  rango: Rango,
  ahora: string,
): FilaCamarero[] {
  const dentro = (iso: string) => iso >= rango.desde && iso < rango.hasta;
  const filas = new Map<string, FilaCamarero>();
  const fila = (id: string | null) => {
    if (!id) return null;
    let f = filas.get(id);
    if (!f) {
      const e = estado.empleados.find((x) => x.id === id);
      f = {
        empleado: { id, nombre: e?.nombre ?? "Persona borrada" },
        ventas: 0,
        tickets: 0,
        propinas: 0,
        anulaciones: 0,
        importeAnulado: 0,
        invitaciones: 0,
        importeInvitado: 0,
        minutos: 0,
      };
      filas.set(id, f);
    }
    return f;
  };
  for (const t of estado.tickets) {
    if (!dentro(t.fecha)) continue;
    const f = fila(t.empleadoId);
    if (!f) continue;
    f.ventas += t.total;
    f.propinas += t.propina ?? 0;
    if (!t.rectificaA) f.tickets += 1;
  }
  for (const i of estado.incidencias) {
    if (!dentro(i.fecha)) continue;
    // Cuenta para quien lo anotó (era su mesa); si no se sabe, para quien lo hizo.
    const f = fila(i.anotadaPor ?? i.empleadoId);
    if (!f) continue;
    if (i.tipo === "anulacion") {
      f.anulaciones += i.cantidad;
      f.importeAnulado += i.importe;
    } else {
      f.invitaciones += i.cantidad;
      f.importeInvitado += i.importe;
    }
  }
  for (const fi of estado.fichajes) {
    if (!fi.salida || !dentro(fi.entrada)) continue;
    const f = fila(fi.empleadoId);
    if (f) f.minutos += minutosTrabajados(fi, ahora);
  }
  return [...filas.values()].sort((a, b) => b.ventas - a.ventas);
}

export type FichaPersonal = {
  situacion: Situacion;
  /** Desde cuándo está trabajando o en el descanso. */
  desde: string | null;
  /** Turnos previstos para hoy y los próximos (como mucho tres). */
  hoy: Pick<TurnoCuadrante, "desde" | "hasta" | "puesto">[];
  proximos: Pick<TurnoCuadrante, "dia" | "desde" | "hasta" | "puesto">[];
  /** Esta semana: minutos trabajados (contando la jornada abierta) y previstos. */
  semana: { trabajados: number; previstos: number };
};

/** Lo que ve una persona al fichar: cómo está, su turno y sus horas de la semana. */
export function fichaPersonal(
  estado: Pick<Estado, "fichajes" | "cuadrante">,
  empleadoId: string,
  ahora: string,
): FichaPersonal {
  const { situacion: s, fichaje } = situacion(estado.fichajes, empleadoId, ahora);
  const hoy = diaLocal(ahora);
  const semana = diasDeSemana(lunesDe(hoy));
  const pausa = fichaje?.pausas.find((p) => !p.fin);
  const sinId = ({ dia, desde, hasta, puesto }: TurnoCuadrante) => ({ dia, desde, hasta, puesto });
  return {
    situacion: s,
    desde: pausa?.inicio ?? fichaje?.entrada ?? null,
    hoy: turnosDe(estado.cuadrante, empleadoId, hoy).map(({ desde, hasta, puesto }) => ({
      desde,
      hasta,
      puesto,
    })),
    proximos: estado.cuadrante
      .filter((t) => t.empleadoId === empleadoId && t.dia > hoy)
      .sort((a, b) => (a.dia + a.desde).localeCompare(b.dia + b.desde))
      .slice(0, 3)
      .map(sinId),
    semana: {
      trabajados: estado.fichajes
        .filter((f) => f.empleadoId === empleadoId && semana.includes(diaLocal(f.entrada)))
        .reduce((total, f) => total + minutosTrabajados(f, ahora), 0),
      previstos: estado.cuadrante
        .filter((t) => t.empleadoId === empleadoId && semana.includes(t.dia))
        .reduce((total, t) => total + minutosTurno(t), 0),
    },
  };
}
