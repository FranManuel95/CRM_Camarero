import { DIAS_EN_PANTALLA } from "../constantes";
import { servicios } from "./servicios";
import { activa, disponible } from "../dominio/funciones";
import { cuentaDeMesa } from "../dominio/reducir";
import { reglasClub } from "../dominio/club";
import { cuentaEnJuego, nombreLlevar } from "../dominio/selectores";
import { pagadoCuenta, totalCuenta } from "../dominio/importes";
import { dentroDeHorario } from "../dominio/horario";
import type { Cuenta, Empleado, Estado, LineaCuenta } from "../dominio/tipos";

/**
 * Lo que ve el personal: todo menos los PIN y el historial antiguo. Las cuentas cerradas no
 * hacen falta en las pantallas: lo cobrado está en los tickets. Los fichajes y las anulaciones
 * de los demás solo los ve el encargado.
 */
export function vistaPersonal(
  estado: Estado,
  local: string,
  quien: Pick<Empleado, "id" | "rol">,
  ahora = Date.now(),
) {
  const desde = new Date(ahora - DIAS_EN_PANTALLA * 86_400_000).toISOString();
  const suyo = (empleadoId: string | null) => quien.rol === "encargado" || empleadoId === quien.id;
  return {
    ...estado,
    /** Identificador del bar (va en la dirección de los QR). */
    local,
    /** Qué claves tiene el servidor: sin ellas, algunas funciones no se pueden encender. */
    servicios: servicios(),
    /** A qué AEAT van los registros de VERI*FACTU (pruebas mientras no se diga otra cosa). */
    entornoAeat: process.env.VERIFACTU_ENTORNO === "produccion" ? "produccion" : "pruebas",
    empleados: estado.empleados.map((e) => ({ ...e, pin: "" })),
    cuentas: estado.cuentas.filter((c) => cuentaEnJuego(c, ahora)),
    tickets: estado.tickets.filter((t) => t.fecha >= desde),
    turnos: estado.turnos.filter((t) => !t.cerradoEn || t.cerradoEn >= desde),
    fichajes: estado.fichajes.filter(
      (f) => suyo(f.empleadoId) && (f.entrada >= desde || !f.salida),
    ),
    historial: quien.rol === "encargado" ? estado.historial.filter((h) => h.fecha >= desde) : [],
    incidencias: estado.incidencias.filter(
      (i) => i.fecha >= desde && (suyo(i.empleadoId) || suyo(i.anotadaPor)),
    ),
  };
}
export type VistaPersonal = ReturnType<typeof vistaPersonal>;

export type LineaCliente = Pick<
  LineaCuenta,
  "id" | "nombre" | "cantidad" | "precioUnitario" | "opciones" | "nota" | "estado" | "invitacion"
> & { pagada: boolean };

/** Lo que tarda en desaparecer de la carta el ticket de la cuenta recién pagada. */
const MINUTOS_ULTIMO_TICKET = 30;

/**
 * Lo que ve un cliente desde el QR: la carta y su mesa (o su encargo para llevar, si el código
 * es el de un encargo). Nada de otras mesas ni de los datos del local.
 */
export function vistaCliente(estado: Estado, token: string, ahora = new Date().toISOString()) {
  const mesaQR = estado.mesas.find((m) => m.token === token);
  const encargo = mesaQR ? undefined : estado.cuentas.find((c) => c.llevar?.token === token);
  if (!mesaQR && !encargo?.llevar) return null;
  const mesa = mesaQR ?? { id: encargo!.mesaId, nombre: nombreLlevar(encargo!.llevar!) };
  const categorias = estado.categorias
    .filter((c) => c.visibleEnQR && dentroDeHorario(c.horario, ahora))
    .sort((a, b) => a.orden - b.orden);
  const ids = new Set(categorias.map((c) => c.id));
  // Un encargo se sigue viendo después de pagarlo (para saber cuándo está listo).
  const cuenta: Cuenta | undefined =
    encargo && encargo.estado !== "anulada" ? encargo : cuentaDeMesa(estado, mesa.id);
  // La última cuenta pagada de la mesa, para pedir el ticket por correo o dejar una reseña.
  const desde = new Date(Date.parse(ahora) - MINUTOS_ULTIMO_TICKET * 60_000).toISOString();
  const pagada = encargo
    ? encargo.estado === "cobrada"
      ? encargo
      : undefined
    : estado.cuentas.findLast(
        (c) => c.mesaId === mesa.id && c.estado === "cobrada" && (c.cerradaEn ?? "") >= desde,
      );
  const ticket = pagada?.ticketId
    ? estado.tickets.find((t) => t.id === pagada.ticketId)
    : undefined;
  const { ajustes } = estado;
  const servidor = servicios();
  const lineas: LineaCliente[] = (cuenta?.lineas ?? [])
    .filter((l) => l.estado !== "anulada")
    .map(
      ({
        id,
        nombre,
        cantidad,
        precioUnitario,
        opciones,
        nota,
        estado: e,
        invitacion,
        ticketId,
      }) => ({
        id,
        nombre,
        cantidad,
        precioUnitario,
        opciones,
        nota,
        estado: e,
        invitacion,
        pagada: Boolean(ticketId),
      }),
    );
  const avisos = estado.avisos
    .filter((a) => a.mesaId === mesa.id && !a.atendido)
    .map((a) => a.tipo);
  return {
    local: {
      nombre: estado.ajustes.nombreLocal,
      pedidosActivos: estado.ajustes.pedidosQRActivos,
      confirmarPedidos: estado.ajustes.confirmarPedidosQR,
      ingles: activa(ajustes, "cartaIngles"),
      ticketCorreo: disponible(ajustes, servidor, "ticketCorreo"),
      /** Enlace para dejar una reseña, si el bar lo pide. */
      resena: (activa(ajustes, "resenas") && ajustes.enlaceResena) || null,
      /** El club de clientes y cómo se ganan los puntos (si el bar lo tiene). */
      club: activa(ajustes, "club") ? reglasClub(estado) : null,
    },
    mesa: { nombre: mesa.nombre },
    /** Solo en los encargos para llevar. */
    llevar: encargo?.llevar ? { recogida: encargo.llevar.recogida } : null,
    categorias: categorias.map(({ id, nombre, nombreEn }) => ({ id, nombre, nombreEn })),
    productos: estado.productos
      .filter((p) => ids.has(p.categoriaId) && !p.oculto)
      .sort((a, b) => a.orden - b.orden)
      .map(
        ({
          id,
          categoriaId,
          nombre,
          descripcion,
          nombreEn,
          descripcionEn,
          foto,
          precio,
          alergenos,
          disponible,
          grupos,
        }) => ({
          id,
          categoriaId,
          nombre,
          descripcion,
          nombreEn,
          descripcionEn,
          foto,
          precio,
          alergenos,
          disponible,
          grupos,
        }),
      ),
    cuenta: cuenta
      ? {
          lineas,
          total: totalCuenta(cuenta),
          pagado: pagadoCuenta(cuenta),
          /** Si ya suma puntos del club, para quién (solo el nombre de pila). */
          club: cuenta.clienteId
            ? (estado.clientes.find((c) => c.id === cuenta.clienteId)?.nombre.split(" ")[0] ?? null)
            : null,
        }
      : null,
    /** El ticket de lo último que se pagó (en la última media hora). */
    ticket: ticket ? { id: ticket.id, numero: ticket.numero, total: ticket.total } : null,
    avisos,
  };
}
export type VistaCliente = NonNullable<ReturnType<typeof vistaCliente>>;
