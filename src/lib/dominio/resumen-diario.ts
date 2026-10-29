import { diaLocal } from "../fechas";
import { resumenTurno } from "./caja";
import { euros } from "./importes";
import { informe, rangoDeDias, sumarDias } from "./informes";
import type { Estado } from "./tipos";

/** Un apartado del resumen: título y frases. */
export type Apartado = { titulo: string; lineas: string[] };

const NOMBRE_DIA = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** «martes 27 de octubre» a partir de «2026-10-27». */
export const fechaLarga = (dia: string) => NOMBRE_DIA.format(new Date(`${dia}T12:00:00Z`));

const variacion = (ahora: number, antes: number) => {
  if (!antes) return "";
  const pct = Math.round(((ahora - antes) / antes) * 100);
  return pct === 0
    ? " (igual que el mismo día de la semana pasada)"
    : ` (${pct > 0 ? "+" : ""}${pct} % que el mismo día de la semana pasada)`;
};

/**
 * Lo que el dueño quiere saber de un día sin ir al bar: ventas, caja, anulaciones, lo más
 * vendido, gastos y las reservas del día siguiente.
 */
export function resumenDelDia(
  estado: Estado,
  dia: string,
): { asunto: string; apartados: Apartado[] } {
  const r = informe(estado, rangoDeDias(dia, dia));
  const semanaPasada = informe(estado, rangoDeDias(sumarDias(dia, -7), sumarDias(dia, -7)));
  const local = estado.ajustes.nombreLocal;
  const apartados: Apartado[] = [];

  const ventas = [
    r.tickets
      ? `Vendido: ${euros(r.ventas)} en ${r.tickets} tickets${variacion(r.ventas, semanaPasada.ventas)}.`
      : "Ese día no se cobró nada.",
  ];
  if (r.tickets) ventas.push(`Ticket medio: ${euros(r.ticketMedio)}.`);
  const metodos = (
    [
      ["efectivo", "efectivo"],
      ["tarjeta", "tarjeta"],
      ["bizum", "Bizum"],
      ["otro", "otros"],
      ["fiado", "a deber"],
    ] as const
  )
    .filter(([m]) => r.porMetodo[m])
    .map(([m, t]) => `${euros(r.porMetodo[m])} ${t}`);
  if (metodos.length) ventas.push(`Cobrado: ${metodos.join(" · ")}.`);
  if (r.propinas) ventas.push(`Propinas: ${euros(r.propinas)}.`);
  apartados.push({ titulo: "Ventas", lineas: ventas });

  // Cierres de caja de ese día.
  const cierres = estado.turnos.filter((t) => t.cerradoEn && diaLocal(t.cerradoEn) === dia);
  apartados.push({
    titulo: "Caja",
    lineas: cierres.length
      ? cierres.map((t) => {
          const d = resumenTurno(estado, t).descuadre ?? 0;
          return `Cierre Z nº ${t.numero}: ${d === 0 ? "cuadró" : d < 0 ? `faltaron ${euros(-d)}` : `sobraron ${euros(d)}`}.`;
        })
      : ["No se cerró la caja ese día."],
  });

  // Anulaciones e invitaciones, y de quién.
  const desde = rangoDeDias(dia, dia);
  const incidencias = estado.incidencias.filter(
    (i) => i.fecha >= desde.desde && i.fecha < desde.hasta,
  );
  const control: string[] = [];
  for (const tipo of ["anulacion", "invitacion"] as const) {
    const lista = incidencias.filter((i) => i.tipo === tipo);
    if (!lista.length) continue;
    const porPersona = new Map<string, number>();
    for (const i of lista)
      porPersona.set(i.empleadoId, (porPersona.get(i.empleadoId) ?? 0) + i.cantidad);
    const quien = [...porPersona.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${estado.empleados.find((e) => e.id === id)?.nombre ?? "—"} ${n}`)
      .join(", ");
    const importe = lista.reduce((s, i) => s + i.importe, 0);
    const cantidad = lista.reduce((s, i) => s + i.cantidad, 0);
    control.push(
      `${tipo === "anulacion" ? "Anulado" : "Invitado"}: ${cantidad} (${euros(importe)}). ${quien}.`,
    );
  }
  if (r.devoluciones) control.push(`Devoluciones: ${euros(r.devoluciones)}.`);
  apartados.push({
    titulo: "Anulaciones e invitaciones",
    lineas: control.length ? control : ["Ninguna."],
  });

  if (r.productos.length)
    apartados.push({
      titulo: "Lo más vendido",
      lineas: r.productos.slice(0, 5).map((p) => `${p.nombre}: ${p.unidades} (${euros(p.ventas)})`),
    });

  const gastos = estado.gastos.filter((g) => diaLocal(g.fecha) === dia);
  if (gastos.length)
    apartados.push({
      titulo: "Gastos apuntados",
      lineas: gastos.map(
        (g) => `${g.concepto}${g.proveedor ? ` (${g.proveedor})` : ""}: ${euros(g.importe)}`,
      ),
    });

  const manana = sumarDias(dia, 1);
  const reservas = estado.reservas.filter(
    (x) => x.dia === manana && (x.estado === "confirmada" || x.estado === "por_confirmar"),
  );
  if (reservas.length)
    apartados.push({
      titulo: `Reservas para el ${fechaLarga(manana)}`,
      lineas: [
        `${reservas.length} ${reservas.length === 1 ? "reserva" : "reservas"}, ${reservas.reduce((s, x) => s + x.personas, 0)} personas.`,
        ...(reservas.some((x) => x.estado === "por_confirmar")
          ? [`Por confirmar: ${reservas.filter((x) => x.estado === "por_confirmar").length}.`]
          : []),
      ],
    });

  return {
    asunto: `${local}: ${fechaLarga(dia)}, ${euros(r.ventas)} vendidos`,
    apartados,
  };
}

/** El resumen en texto plano (para el correo y para verlo en pantalla). */
export function resumenEnTexto(resumen: { apartados: Apartado[] }): string {
  return resumen.apartados
    .map((a) => `${a.titulo.toUpperCase()}\n${a.lineas.map((l) => `· ${l}`).join("\n")}`)
    .join("\n\n");
}
