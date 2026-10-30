import { diaLocal } from "../fechas";
import { resumenTurno } from "./caja";
import { activa } from "./funciones";
import { euros } from "./importes";
import { inicioDelDia, sumarDias } from "./informes";
import { bajoMinimo } from "./stock";
import type { Estado } from "./tipos";

export type Alerta = {
  /** Estable entre recargas: sirve para no avisar dos veces de lo mismo. */
  clave: string;
  /** «urgente» se ve en rojo y salta como notificación; «aviso», en amarillo. */
  nivel: "urgente" | "aviso";
  texto: string;
  enlace: string;
};

/** Anulaciones de una persona en un día a partir de las que se avisa. */
export const ANULACIONES_PARA_AVISAR = 4;
/** Descuadre de caja (en céntimos, arriba o abajo) a partir del que se avisa. */
export const DESCUADRE_PARA_AVISAR = 200;

/**
 * Lo que el encargado debería mirar: descuadres, muchas anulaciones, stock en el mínimo,
 * reservas sin confirmar, envíos rechazados por Hacienda y lo que se debe.
 */
export function alertasEncargado(estado: Estado, ahora: string): Alerta[] {
  const alertas: Alerta[] = [];
  const hoy = diaLocal(ahora);
  const ajustes = estado.ajustes;

  // Descuadre en el último cierre (si fue hoy o ayer).
  const cerrado = estado.turnos
    .filter((t) => t.cerradoEn)
    .sort((a, b) => b.cerradoEn!.localeCompare(a.cerradoEn!))[0];
  if (cerrado && diaLocal(cerrado.cerradoEn!) >= sumarDias(hoy, -1)) {
    const descuadre = (cerrado.cifras ?? resumenTurno(estado, cerrado)).descuadre;
    if (descuadre !== null && Math.abs(descuadre) >= DESCUADRE_PARA_AVISAR)
      alertas.push({
        clave: `descuadre-${cerrado.id}`,
        nivel: "urgente",
        texto:
          descuadre < 0
            ? `En el último cierre de caja faltaron ${euros(-descuadre)}.`
            : `En el último cierre de caja sobraron ${euros(descuadre)}.`,
        enlace: "/caja",
      });
  }

  // Muchas anulaciones hoy de la misma persona.
  const desde = inicioDelDia(hoy);
  const porEmpleado = new Map<string, { cantidad: number; importe: number }>();
  for (const i of estado.incidencias) {
    if (i.tipo !== "anulacion" || i.fecha < desde) continue;
    const previo = porEmpleado.get(i.empleadoId) ?? { cantidad: 0, importe: 0 };
    porEmpleado.set(i.empleadoId, {
      cantidad: previo.cantidad + i.cantidad,
      importe: previo.importe + i.importe,
    });
  }
  for (const [empleadoId, { cantidad, importe }] of porEmpleado) {
    if (cantidad < ANULACIONES_PARA_AVISAR) continue;
    const nombre = estado.empleados.find((e) => e.id === empleadoId)?.nombre ?? "Alguien";
    alertas.push({
      clave: `anulaciones-${hoy}-${empleadoId}-${cantidad}`,
      nivel: "urgente",
      texto: `${nombre} lleva ${cantidad} anulaciones hoy (${euros(importe)}).`,
      enlace: "/gestion/informes",
    });
  }

  // Reservas pedidas desde la web que nadie ha confirmado.
  const porConfirmar = estado.reservas.filter((r) => r.estado === "por_confirmar" && r.dia >= hoy);
  if (porConfirmar.length)
    alertas.push({
      clave: `reservas-${porConfirmar.map((r) => r.id).join(",")}`,
      nivel: "urgente",
      texto:
        porConfirmar.length === 1
          ? `Hay una reserva por confirmar: ${porConfirmar[0]!.nombre}, ${porConfirmar[0]!.personas} personas.`
          : `Hay ${porConfirmar.length} reservas por confirmar.`,
      enlace: "/sala/reservas",
    });

  // Envíos a Hacienda rechazados.
  if (activa(ajustes, "verifactu")) {
    const rechazados = (estado.verifactu?.registros ?? []).filter((r) => r.estado === "incorrecto");
    if (rechazados.length)
      alertas.push({
        clave: `verifactu-${rechazados.length}`,
        nivel: "urgente",
        texto: `Hacienda ha rechazado ${rechazados.length === 1 ? "un ticket" : `${rechazados.length} tickets`}. Míralo en VERI*FACTU.`,
        enlace: "/gestion/verifactu",
      });
  }

  // Ingredientes en el mínimo.
  if (activa(ajustes, "stock")) {
    const bajos = estado.ingredientes.filter(bajoMinimo);
    if (bajos.length)
      alertas.push({
        clave: `stock-${bajos.map((i) => i.id).join(",")}`,
        nivel: "aviso",
        texto: `En el mínimo: ${bajos.map((i) => i.nombre).join(", ")}.`,
        enlace: "/gestion/stock",
      });
  }

  // Lo que deben los clientes.
  if (activa(ajustes, "fiado")) {
    const deudores = estado.clientes.filter((c) => (c.deuda ?? 0) > 0);
    const total = deudores.reduce((s, c) => s + (c.deuda ?? 0), 0);
    if (total)
      alertas.push({
        clave: `fiado-${total}`,
        nivel: "aviso",
        texto: `Os deben ${euros(total)} entre ${deudores.length} ${deudores.length === 1 ? "cliente" : "clientes"}.`,
        enlace: "/gestion/clientes",
      });
  }

  return alertas;
}
