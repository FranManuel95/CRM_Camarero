import { DIAS_EN_PANTALLA } from "../constantes";
import { servicios } from "./servicios";
import { activa, disponible } from "../dominio/funciones";
import { cuentaDeMesa } from "../dominio/reducir";
import { reglasClub } from "../dominio/club";
import { precioConTarifa } from "../dominio/tarifas";
import { cuentaEnJuego, nombreLlevar } from "../dominio/selectores";
import { pagadoCuenta, totalCuenta } from "../dominio/importes";
import { cartaInicial, cartasDisponibles, categoriaEnServicio } from "../dominio/cartas";
import { resumenTurno } from "../dominio/caja";
import { inicioDelDia } from "../dominio/informes";
import { MAX_SUYOS, masPedidos, mezclarRapidos } from "../dominio/rapidos";
import { diaLocal } from "../fechas";
import type { Cuenta, Empleado, Estado, LineaCuenta, Producto } from "../dominio/tipos";

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
  const ahoraIso = new Date(ahora).toISOString();
  const encargado = quien.rol === "encargado";
  const suyo = (empleadoId: string | null) => encargado || empleadoId === quien.id;
  // Con los datos en directo solo viajan los tickets de hoy y del turno abierto: los demás se
  // piden aparte cuando hacen falta (informes). Así cada recarga pesa poco aunque el bar lleve
  // meses vendiendo.
  const abierto = estado.turnos.find((t) => !t.cerradoEn);
  const hoy = inicioDelDia(diaLocal(ahoraIso));
  const desdeTickets = abierto && abierto.abiertoEn < hoy ? abierto.abiertoEn : hoy;
  const {
    gastos,
    vinculos,
    ultimosTickets,
    masPedidos: calculados,
    masPedidosEquipo,
    ticketsDesde,
    ...resto
  } = estado;
  const favoritos = favoritosDe(estado);
  return {
    ...resto,
    gastos: encargado ? gastos : [],
    vinculos: encargado ? vinculos : [],
    /**
     * Pestaña «Rápidos» de esta persona: los favoritos, lo que más pide ella y lo más pedido en
     * el bar a esta hora.
     */
    rapidos: mezclarRapidos({
      favoritos,
      suyos:
        masPedidosEquipo?.[quien.id] ?? masPedidos(estado.tickets, ahoraIso, MAX_SUYOS, quien.id),
      bar: calculados ?? masPedidos(estado.tickets, ahoraIso),
    }),
    /** Si el bar ya ha cobrado alguna vez (primeros pasos). */
    hayTickets: estado.tickets.length > 0 || Boolean(ultimosTickets?.length),
    // El correo del dueño solo lo ve el encargado.
    ajustes: encargado ? estado.ajustes : { ...estado.ajustes, resumenDiario: undefined },
    /** Identificador del bar (va en la dirección de los QR). */
    local,
    /** Qué claves tiene el servidor: sin ellas, algunas funciones no se pueden encender. */
    servicios: servicios(),
    /** A qué AEAT van los registros de VERI*FACTU (pruebas mientras no se diga otra cosa). */
    entornoAeat: process.env.VERIFACTU_ENTORNO === "produccion" ? "produccion" : "pruebas",
    empleados: estado.empleados.map((e) => ({ ...e, pin: "" })),
    cuentas: estado.cuentas.filter((c) => cuentaEnJuego(c, ahora)),
    tickets: estado.tickets.filter((t) => t.fecha >= desdeTickets),
    turnos: estado.turnos
      .filter((t) => !t.cerradoEn || t.cerradoEn >= desde)
      .map((t) => {
        if (!t.cerradoEn || t.cifras) return t;
        // Cierres de antes de que se guardaran sus cifras: solo si sus tickets están leídos.
        if (ticketsDesde && t.abiertoEn < ticketsDesde) return { ...t, cifras: null };
        const r = resumenTurno(estado, t);
        return { ...t, cifras: { ventas: r.ventas, tickets: r.tickets, descuadre: r.descuadre } };
      }),
    tiemposCocina: encargado
      ? (estado.tiemposCocina ?? []).filter((x) => x.dia >= desde.slice(0, 10))
      : [],
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

/** Nombres de los favoritos que se pueden pedir, por el orden de la carta. */
function favoritosDe(estado: Estado): string[] {
  return estado.productos
    .filter((p) => p.favorito && !p.oculto)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => p.nombre);
}

/** Cuántos platos salen en «Lo más pedido» de la carta QR. */
const MAX_DESTACADOS = 6;

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
    .filter((c) => c.visibleEnQR && categoriaEnServicio(estado, c, ahora))
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
  const zonaId = mesaQR?.zonaId ?? null;
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
    /** Las cartas que se pueden elegir ahora (Desayunos, Copas…), si el bar las usa. */
    cartas: cartasDisponibles(estado, ahora).map(({ id, nombre, nombreEn, categoriaIds }) => ({
      id,
      nombre,
      nombreEn,
      categoriaIds: categoriaIds.filter((c) => ids.has(c)),
    })),
    /**
     * «Lo más pedido», arriba de la carta: los favoritos del bar y lo que más se pide a esta hora,
     * solo de lo que se puede pedir aquí y ahora (ids de producto).
     */
    destacados: mezclarRapidos({
      favoritos: favoritosDe(estado),
      suyos: [],
      bar: estado.masPedidos ?? masPedidos(estado.tickets, ahora),
      max: 40,
    })
      .map((nombre) =>
        estado.productos.find(
          (p) => p.nombre === nombre && ids.has(p.categoriaId) && !p.oculto && p.disponible,
        ),
      )
      .filter((p): p is Producto => Boolean(p))
      .slice(0, MAX_DESTACADOS)
      .map((p) => p.id),
    /** La que se enseña primero (la que toca por horario, o la primera). */
    cartaInicial: cartaInicial(estado, ahora),
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
        }) => {
          // El precio de ahora en esta mesa (happy hour, terraza…).
          const especial = activa(ajustes, "tarifas")
            ? precioConTarifa(estado, { precio, categoriaId }, zonaId, ahora)
            : { precio };
          return {
            id,
            categoriaId,
            nombre,
            descripcion,
            nombreEn,
            descripcionEn,
            foto,
            precio: especial.precio,
            ...(especial.precio !== precio ? { precioCarta: precio, tarifa: especial.tarifa } : {}),
            alergenos,
            disponible,
            grupos,
          };
        },
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
