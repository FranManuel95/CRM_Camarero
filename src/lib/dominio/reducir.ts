import type {
  AccionCliente,
  AccionEncargado,
  AccionPersonal,
  AltaClub,
  EncargoOnline,
  LineaPedida,
  ReservaOnline,
} from "./acciones";
import { turnoAbierto } from "./caja";
import { type EntornoAeat, sellarTicket } from "./verifactu";
import { resumenPin } from "./pin";
import {
  aplicarDescuento,
  calcularCambio,
  desgloseIva,
  importeLinea,
  subtotalCuenta,
  euros,
  lineasCobrables,
  lineasDeTicket,
  precioConOpciones,
  totalCuenta,
  totalPagos,
} from "./importes";
import { dentroDeHorario } from "./horario";
import { buscarMesa, lineasPara, MESA_VENTA_RAPIDA, PREFIJO_LLEVAR } from "./selectores";
import { descontar, devolver, redondear, revisarAgotados } from "./stock";
import { activa, type Funcion, FUNCIONES } from "./funciones";
import { describir } from "./historial";
import { apuntarCompra, reglasClub, telefonoLimpio } from "./club";
import { diasDeSemana, instante, jornadaAbierta, lunesDe } from "./equipo";
import { sumarDias } from "./informes";
import { diaLocal, formatearHora } from "../fechas";
import type {
  Aviso,
  Centimos,
  ClienteClub,
  Cuenta,
  Destino,
  Empleado,
  Estado,
  Fichaje,
  Gasto,
  Incidencia,
  LineaCuenta,
  Mesa,
  MovimientoStock,
  OpcionElegida,
  Pago,
  Producto,
  Reserva,
  Ticket,
  TipoAviso,
  TipoTrabajo,
  TrabajoImpresion,
} from "./tipos";
import type { Bloque } from "../impresion/documento";
import {
  plantillaCierre,
  plantillaComanda,
  plantillaPrecuenta,
  plantillaPrueba,
  plantillaTicket,
} from "../impresion/plantillas";

/** Error con un mensaje para enseñar tal cual en la pantalla. */
export class ErrorAccion extends Error {}

export type Contexto = {
  ahora: string;
  nuevoId: () => string;
  /** Un código largo y difícil de adivinar, para los QR de las mesas. */
  nuevoToken: () => string;
  /** Seis cifras al azar, para vincular aparatos. */
  nuevoCodigo: () => string;
  /** Con VERI*FACTU, a qué AEAT apuntan los QR (pruebas mientras no se diga otra cosa). */
  entornoAeat?: EntornoAeat;
};

export type Resultado = { estado: Estado; trabajos: TrabajoImpresion[] };

const MAX_TRABAJOS = 300;
const MAX_AVISOS_ATENDIDOS = 200;
const MAX_MOVIMIENTOS_STOCK = 1000;
const MAX_INCIDENCIAS = 3000;
const DIAS_CUADRANTE = 120;
const MAX_HISTORIAL = 1000;
/** Las reservas se guardan unos meses (para ver quién no vino) y luego se olvidan. */
const DIAS_RESERVAS = 90;

function falla(mensaje: string): never {
  throw new ErrorAccion(mensaje);
}

function buscar<T extends { id: string }>(lista: T[], id: string, queEs: string): T {
  return lista.find((x) => x.id === id) ?? falla(`No encuentro ${queEs}. Puede que ya no exista.`);
}

/** Cocina también trabaja con lo ya cobrado (ventas rápidas) mientras no salga. */
function cuentaParaCocina(estado: Estado, cuentaId: string): Cuenta {
  const cuenta = buscar(estado.cuentas, cuentaId, "esa cuenta");
  if (cuenta.estado === "anulada") falla("Esta cuenta está anulada.");
  return cuenta;
}

function cuentaAbierta(estado: Estado, cuentaId: string): Cuenta {
  const cuenta = buscar(estado.cuentas, cuentaId, "esa cuenta");
  if (cuenta.estado !== "abierta") falla("Esta cuenta ya está cerrada.");
  return cuenta;
}

export function cuentaDeMesa(estado: Pick<Estado, "cuentas">, mesaId: string): Cuenta | undefined {
  return estado.cuentas.find((c) => c.mesaId === mesaId && c.estado === "abierta");
}

/** Convierte lo que pide alguien (ids) en líneas con nombre, precio e IVA copiados. */
function crearLineas(
  estado: Estado,
  pedidas: LineaPedida[],
  ctx: Contexto,
  datos: Pick<LineaCuenta, "estado" | "origen" | "empleadoId" | "ronda" | "enviadaEn">,
  /** «qr»: lo pide un cliente. «encargado»: puede anotar lo agotado o lo oculto. */
  quien: "qr" | "camarero" | "encargado",
): LineaCuenta[] {
  const soloVisiblesEnQR = quien === "qr";
  return pedidas.map((p) => {
    const producto = buscar(estado.productos, p.productoId, "ese producto");
    const categoria = estado.categorias.find((c) => c.id === producto.categoriaId);
    if (quien !== "encargado") {
      if (producto.oculto) falla(`${producto.nombre} no está en la carta ahora mismo.`);
      if (!producto.disponible) falla(`${producto.nombre} está agotado ahora mismo.`);
    }
    if (soloVisiblesEnQR && categoria && !categoria.visibleEnQR)
      falla(`${producto.nombre} no se puede pedir desde aquí.`);
    if (soloVisiblesEnQR && categoria && !dentroDeHorario(categoria.horario, ctx.ahora))
      falla(`${producto.nombre} no se sirve a esta hora.`);
    return {
      id: ctx.nuevoId(),
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitario: producto.precio,
      iva: producto.iva,
      destino: categoria?.destino ?? "cocina",
      cantidad: p.cantidad,
      opciones: elegirOpciones(producto, p.opciones),
      nota: p.nota,
      ...(p.despues && activa(estado.ajustes, "paraDespues") ? { despues: true } : {}),
      creadaEn: ctx.ahora,
      listaEn: null,
      invitacion: false,
      ...datos,
    };
  });
}

export function elegirOpciones(producto: Producto, ids: string[]): OpcionElegida[] {
  const elegidas: OpcionElegida[] = [];
  const usados = new Set<string>();
  for (const grupo of producto.grupos) {
    const delGrupo = grupo.opciones.filter((o) => ids.includes(o.id));
    if (grupo.obligatorio && delGrupo.length === 0)
      falla(`Elige ${grupo.nombre.toLowerCase()} para ${producto.nombre}.`);
    if (!grupo.multiple && delGrupo.length > 1)
      falla(`En ${grupo.nombre.toLowerCase()} solo vale una opción.`);
    for (const o of delGrupo) {
      usados.add(o.id);
      elegidas.push({
        grupo: grupo.nombre,
        nombre: o.nombre,
        suplemento: o.suplemento,
        ...(o.destino ? { destino: o.destino } : {}),
      });
    }
  }
  if (ids.some((i) => !usados.has(i))) falla(`Alguna opción de ${producto.nombre} ya no existe.`);
  return elegidas;
}

function nombreEmpleado(estado: Estado, id: string | null): string {
  return estado.empleados.find((e) => e.id === id)?.nombre ?? "—";
}

/** Crea los trabajos de impresión para las impresoras que se encargan de `para`. */
function encolar(
  estado: Estado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
  tipo: TipoTrabajo,
  titulo: string,
  documento: Bloque[],
  para: "cocina" | "barra" | "tickets" | { impresoraId: string },
) {
  const destino = para === "cocina" || para === "barra" ? para : undefined;
  const impresoras = estado.impresoras.filter((i) =>
    typeof para === "object"
      ? i.id === para.impresoraId
      : i.activa &&
        (para === "cocina"
          ? i.imprimeCocina
          : para === "barra"
            ? i.imprimeBarra
            : i.imprimeTickets),
  );
  const destinos = impresoras.length ? impresoras : [null];
  for (const imp of destinos) {
    const conCajon = imp?.abreCajon ? documento : documento.filter((b) => b.tipo !== "cajon");
    const trabajo: TrabajoImpresion = {
      id: ctx.nuevoId(),
      creadoEn: ctx.ahora,
      tipo,
      impresoraId: imp?.id ?? null,
      ...(destino ? { destino } : {}),
      titulo,
      documento: conCajon,
      // Sin impresora de red, el trabajo queda listo para imprimirlo desde el navegador.
      estado: imp?.conexion === "red" ? "pendiente" : "en_navegador",
    };
    estado.trabajos.push(trabajo);
    trabajos.push(trabajo);
  }
  if (estado.trabajos.length > MAX_TRABAJOS)
    estado.trabajos.splice(0, estado.trabajos.length - MAX_TRABAJOS);
}

function avisar(estado: Estado, ctx: Contexto, mesaId: string, tipo: TipoAviso, detalle: string) {
  const previo = estado.avisos.find((a) => a.mesaId === mesaId && a.tipo === tipo && !a.atendido);
  if (previo && tipo !== "listo") {
    previo.creadoEn = ctx.ahora;
    previo.detalle = detalle;
    return;
  }
  const aviso: Aviso = {
    id: ctx.nuevoId(),
    mesaId,
    tipo,
    creadoEn: ctx.ahora,
    atendido: false,
    detalle,
  };
  estado.avisos.push(aviso);
  const atendidos = estado.avisos.filter((a) => a.atendido);
  if (atendidos.length > MAX_AVISOS_ATENDIDOS) {
    const sobran = new Set(
      atendidos.slice(0, atendidos.length - MAX_AVISOS_ATENDIDOS).map((a) => a.id),
    );
    estado.avisos = estado.avisos.filter((a) => !sobran.has(a.id));
  }
}

function atenderAvisos(estado: Estado, mesaId: string, tipos: TipoAviso[]) {
  for (const a of estado.avisos)
    if (a.mesaId === mesaId && tipos.includes(a.tipo)) a.atendido = true;
}

/** Manda a cocina y barra las líneas indicadas como una ronda nueva, con su comanda impresa. */
/** Imprime la comanda de cada sitio con las líneas dadas. */
function imprimirComandas(
  estado: Estado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
  cuenta: Cuenta,
  lineas: LineaCuenta[],
  empleadoId: string | null,
  marcha = false,
) {
  const mesa = mesaDeCuenta(estado, cuenta);
  for (const destino of ["cocina", "barra"] as Destino[]) {
    const deEste = lineasPara(destino, lineas);
    if (!deEste.length) continue;
    encolar(
      estado,
      ctx,
      trabajos,
      "comanda",
      `${marcha ? "Marcha · " : ""}${destino === "cocina" ? "Cocina" : "Barra"} · ${mesa.nombre} · ronda ${cuenta.rondas}`,
      plantillaComanda({
        mesa,
        destino,
        lineas: deEste,
        ronda: cuenta.rondas,
        camarero: nombreEmpleado(estado, empleadoId ?? cuenta.empleadoId),
        comensales: cuenta.comensales,
        fecha: ctx.ahora,
        marcha,
      }),
      destino,
    );
  }
}

/**
 * Manda a cocina y barra las líneas indicadas como una ronda nueva, con su comanda impresa. Las
 * marcadas «para después» quedan en espera hasta la marcha (salen en la comanda para que cocina
 * sepa lo que viene).
 */
function mandarRonda(
  estado: Estado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
  cuenta: Cuenta,
  lineas: LineaCuenta[],
  empleadoId: string | null,
  imprimir = estado.ajustes.imprimirComandas ?? true,
) {
  if (!lineas.length) return;
  cuenta.rondas += 1;
  for (const l of lineas) {
    l.estado = l.despues ? "en_espera" : "enviada";
    l.enviadaEn = ctx.ahora;
    l.ronda = cuenta.rondas;
    if (!l.empleadoId) l.empleadoId = empleadoId;
  }
  descontar(estado, lineas);
  if (imprimir) imprimirComandas(estado, ctx, trabajos, cuenta, lineas, empleadoId);
}

/** La mesa de una cuenta (las ventas rápidas no tienen mesa de verdad). */
function mesaDeCuenta(estado: Estado, cuenta: Cuenta): Mesa {
  return (
    buscarMesa(estado, cuenta.mesaId) ?? falla("No encuentro la mesa. Puede que ya no exista.")
  );
}

/**
 * Cobra unas líneas de una cuenta: hace el ticket, lo imprime y apunta en cada línea con qué
 * ticket se pagó. Si ya no queda nada por pagar, cierra la cuenta.
 */
function cobrarLineas(
  estado: Estado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
  cuenta: Cuenta,
  seleccion: LineaCuenta[],
  pagos: Pago[],
  propina: Centimos,
  empleado: Empleado,
  cerrarServidas: boolean,
) {
  if (!turnoAbierto(estado)) falla("Abre la caja antes de cobrar (Gestión → Caja).");
  // El descuento en euros se aplica en el pago que deja la cuenta saldada.
  const saldaLaCuenta = lineasCobrables(cuenta).every((l) => seleccion.includes(l));
  const descuentoImporte = saldaLaCuenta ? (cuenta.descuentoImporte ?? 0) : 0;
  const canjeClub = saldaLaCuenta ? (cuenta.canje?.importe ?? 0) : 0;
  const parte = {
    lineas: seleccion,
    descuento: cuenta.descuento,
    descuentoImporte,
    ...(canjeClub ? { canje: { puntos: 0, importe: canjeClub } } : {}),
  };
  const total = totalCuenta(parte);
  const aPagar = total + propina;
  const entregado = totalPagos(pagos);
  if (entregado < aPagar) falla(`Faltan ${euros(aPagar - entregado)} por cobrar.`);
  const cambio = calcularCambio(aPagar, pagos);
  if (entregado - aPagar > cambio) falla("Con tarjeta o Bizum no se puede cobrar de más.");
  const mesa = mesaDeCuenta(estado, cuenta);
  const lineas = lineasDeTicket(parte);
  const desglose = desgloseIva(lineas, cuenta.descuento, descuentoImporte + canjeClub);
  const sig = siguienteTicket(estado, ctx);
  const ticket = sellarTicket(
    estado,
    {
      id: ctx.nuevoId(),
      ...sig,
      fecha: ctx.ahora,
      cuentaId: cuenta.id,
      mesaNombre: mesa.nombre,
      empleadoId: cuenta.empleadoId ?? empleado.id,
      lineas,
      descuento: cuenta.descuento,
      ...(descuentoImporte ? { descuentoImporte } : {}),
      ...(canjeClub ? { canjeClub } : {}),
      desglose,
      total,
      pagos: pagos.filter((p) => p.importe > 0),
      cambio,
      ...(propina ? { propina } : {}),
      rectificaA: null,
    },
    ctx.ahora,
    ctx.entornoAeat,
  );
  for (const l of seleccion) l.ticketId = ticket.id;
  cuenta.ticketId = ticket.id;
  apuntarEnElClub(estado, cuenta, ticket, saldaLaCuenta);
  if (lineasCobrables(cuenta).length === 0) {
    cuenta.estado = "cobrada";
    cuenta.cerradaEn = ctx.ahora;
    if (cerrarServidas)
      for (const l of cuenta.lineas)
        if (l.estado === "enviada" || l.estado === "lista" || l.estado === "en_espera")
          l.estado = "servida";
    atenderAvisos(estado, cuenta.mesaId, ["llamar", "cuenta", "listo", "pedido_qr"]);
  }
  imprimirTicket(
    estado,
    ctx,
    trabajos,
    ticket,
    pagos.some((p) => p.metodo === "efectivo"),
  );
  return ticket;
}

/** Suma los puntos al cliente de la cuenta (y le descuenta el premio si lo ha canjeado). */
function apuntarEnElClub(estado: Estado, cuenta: Cuenta, ticket: Ticket, salda: boolean) {
  if (!cuenta.clienteId || !activa(estado.ajustes, "club")) return;
  const cliente = estado.clientes.find((c) => c.id === cuenta.clienteId);
  if (!cliente) return;
  const puntos = apuntarCompra(cliente, ticket, reglasClub(estado), salda);
  if (salda && cuenta.canje) cliente.puntos = Math.max(0, cliente.puntos - cuenta.canje.puntos);
  // El ticket es nuevo (aún no lo ha visto nadie): se le añade para imprimirlo.
  ticket.club = { nombre: cliente.nombre.split(" ")[0]!, puntos, saldo: cliente.puntos };
}

function siguienteTicket(estado: Estado, ctx: Contexto) {
  const serie = `${estado.ajustes.serieTicket}${ctx.ahora.slice(0, 4)}`;
  const previos = estado.tickets.filter((t) => t.serie === serie);
  const secuencia = previos.reduce((m, t) => Math.max(m, t.secuencia), 0) + 1;
  const anterior = estado.tickets.at(-1);
  return {
    serie,
    secuencia,
    numero: `${serie}-${String(secuencia).padStart(6, "0")}`,
    huellaAnterior: anterior?.huella ?? "",
  };
}

function imprimirTicket(
  estado: Estado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
  ticket: Ticket,
  conCajon: boolean,
) {
  encolar(
    estado,
    ctx,
    trabajos,
    "ticket",
    `Ticket ${ticket.numero} · ${ticket.mesaNombre}`,
    plantillaTicket({
      ajustes: estado.ajustes,
      ticket,
      camarero: estado.empleados.find((e) => e.id === ticket.empleadoId),
      abrirCajon: conCajon,
      resena: enlaceResena(estado),
      urlQr: ticket.urlQr,
    }),
    "tickets",
  );
}

function soloEditable(linea: LineaCuenta) {
  if (linea.estado !== "anotada")
    falla("Esta línea ya se ha mandado; para quitarla hay que anularla.");
}

function comprobarEncargado(empleados: Empleado[]) {
  if (!empleados.some((e) => e.activo && e.rol === "encargado"))
    falla("Tiene que quedar al menos un encargado activo.");
}

/**
 * Copia del estado para modificarla sin tocar la original (si la acción falla a medias, no queda
 * nada a medio cambiar). Los tickets, los trabajos de impresión y las cuentas cerradas no se
 * modifican nunca (un trabajo que se reintenta se sustituye por otro objeto), así que se
 * comparten en vez de copiarse: el estado crece con el historial y copiarlo entero en cada acción
 * se notaría.
 */
export function copiaEditable(estado: Estado): Estado {
  const { tickets, cuentas, trabajos, ...resto } = estado;
  return {
    ...structuredClone(resto),
    tickets: [...tickets],
    trabajos: [...trabajos],
    cuentas: cuentas.map((c) => (c.estado === "abierta" ? structuredClone(c) : c)),
  };
}

/** Aplica una acción del personal. `empleado` es quien la hace (ya comprobado su PIN). */
export function reducirPersonal(
  anterior: Estado,
  accion: AccionPersonal,
  empleado: Empleado,
  ctx: Contexto,
): Resultado {
  const r = aplicarPersonal(anterior, accion, empleado, ctx);
  // Historial de cambios: lo importante, con quién y cuándo.
  if (activa(r.estado.ajustes, "historial") || accion.tipo === "cambiar_funcion") {
    const texto = describir(accion, anterior, r.estado);
    if (texto) {
      r.estado.historial.push({
        id: ctx.nuevoId(),
        fecha: ctx.ahora,
        empleadoId: empleado.id,
        tipo: accion.tipo,
        texto,
      });
      if (r.estado.historial.length > MAX_HISTORIAL)
        r.estado.historial.splice(0, r.estado.historial.length - MAX_HISTORIAL);
    }
  }
  return r;
}

function aplicarPersonal(
  anterior: Estado,
  accion: AccionPersonal,
  empleado: Empleado,
  ctx: Contexto,
): Resultado {
  const estado = copiaEditable(anterior);
  const trabajos: TrabajoImpresion[] = [];

  switch (accion.tipo) {
    case "abrir_cuenta": {
      buscar(estado.mesas, accion.mesaId, "la mesa");
      if (cuentaDeMesa(estado, accion.mesaId)) falla("Esta mesa ya tiene una cuenta abierta.");
      if (accion.cuentaId && estado.cuentas.some((c) => c.id === accion.cuentaId))
        falla("Esa cuenta ya existe.");
      estado.cuentas.push({
        id: accion.cuentaId ?? ctx.nuevoId(),
        mesaId: accion.mesaId,
        estado: "abierta",
        comensales: accion.comensales,
        abiertaEn: ctx.ahora,
        cerradaEn: null,
        empleadoId: empleado.id,
        lineas: [],
        descuento: 0,
        rondas: 0,
        ticketId: null,
      });
      break;
    }
    case "anotar": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      cuenta.empleadoId ??= empleado.id;
      const nuevas = crearLineas(
        estado,
        accion.lineas,
        ctx,
        {
          estado: "anotada",
          origen: "camarero",
          empleadoId: empleado.id,
          ronda: 0,
          enviadaEn: null,
        },
        empleado.rol,
      );
      for (const nueva of nuevas) {
        // Tocar dos veces la caña suma una a la línea sin mandar, no hace otra.
        const igual = cuenta.lineas.find(
          (l) =>
            l.estado === "anotada" &&
            l.productoId === nueva.productoId &&
            l.nota === nueva.nota &&
            Boolean(l.despues) === Boolean(nueva.despues) &&
            JSON.stringify(l.opciones) === JSON.stringify(nueva.opciones),
        );
        if (igual) igual.cantidad = Math.min(99, igual.cantidad + nueva.cantidad);
        else cuenta.lineas.push(nueva);
      }
      break;
    }
    case "cambiar_cantidad": {
      const linea = buscar(
        cuentaAbierta(estado, accion.cuentaId).lineas,
        accion.lineaId,
        "esa línea",
      );
      soloEditable(linea);
      linea.cantidad = accion.cantidad;
      break;
    }
    case "quitar_linea": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      soloEditable(buscar(cuenta.lineas, accion.lineaId, "esa línea"));
      cuenta.lineas = cuenta.lineas.filter((l) => l.id !== accion.lineaId);
      break;
    }
    case "anular_linea": {
      const linea = buscar(
        cuentaAbierta(estado, accion.cuentaId).lineas,
        accion.lineaId,
        "esa línea",
      );
      if (linea.estado === "anulada") falla("Esta línea ya estaba anulada.");
      if (mandada(linea))
        apuntarIncidencia(estado, ctx, "anulacion", linea, empleado, accion.motivo);
      linea.estado = "anulada";
      linea.motivoAnulacion = `${accion.motivo} (${empleado.nombre})`;
      devolver(estado, [linea]);
      break;
    }
    case "invitar_linea": {
      const linea = buscar(
        cuentaAbierta(estado, accion.cuentaId).lineas,
        accion.lineaId,
        "esa línea",
      );
      linea.invitacion = accion.invitacion;
      estado.incidencias = estado.incidencias.filter(
        (i) => !(i.tipo === "invitacion" && i.lineaId === linea.id),
      );
      if (accion.invitacion) apuntarIncidencia(estado, ctx, "invitacion", linea, empleado, "");
      break;
    }
    case "enviar_comanda": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const pendientes = cuenta.lineas.filter((l) => l.estado === "anotada");
      if (!pendientes.length) falla("No hay nada nuevo que mandar.");
      mandarRonda(estado, ctx, trabajos, cuenta, pendientes, empleado.id, accion.imprimir);
      break;
    }
    case "aceptar_pedido_qr": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const pendientes = cuenta.lineas.filter((l) => l.estado === "por_confirmar");
      if (!pendientes.length) falla("Este pedido ya estaba aceptado.");
      cuenta.empleadoId ??= empleado.id;
      mandarRonda(estado, ctx, trabajos, cuenta, pendientes, empleado.id);
      atenderAvisos(estado, cuenta.mesaId, ["pedido_qr"]);
      break;
    }
    case "rechazar_pedido_qr": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      for (const l of cuenta.lineas) {
        if (l.estado === "por_confirmar") {
          l.estado = "anulada";
          l.motivoAnulacion = `Pedido del QR rechazado (${empleado.nombre})`;
        }
      }
      atenderAvisos(estado, cuenta.mesaId, ["pedido_qr"]);
      break;
    }
    case "marcar_lista":
    case "volver_a_preparar":
    case "marcar_servida": {
      const cuenta = cuentaParaCocina(estado, accion.cuentaId);
      const lineas = cuenta.lineas.filter((l) => accion.lineaIds.includes(l.id));
      if (!lineas.length) falla("No encuentro esos platos en la cuenta.");
      for (const l of lineas) {
        if (accion.tipo === "marcar_lista" && l.estado === "enviada") {
          l.estado = "lista";
          l.listaEn = ctx.ahora;
        } else if (accion.tipo === "volver_a_preparar" && l.estado === "lista") {
          l.estado = "enviada";
          l.listaEn = null;
        } else if (
          accion.tipo === "marcar_servida" &&
          (l.estado === "lista" || l.estado === "enviada")
        ) {
          l.estado = "servida";
        }
      }
      if (accion.tipo === "marcar_lista") {
        const resumen = lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(", ");
        avisar(estado, ctx, cuenta.mesaId, "listo", resumen);
      }
      if (accion.tipo === "marcar_servida") {
        for (const a of estado.avisos)
          if (a.mesaId === cuenta.mesaId && a.tipo === "listo") a.atendido = true;
      }
      break;
    }
    case "cambiar_comensales":
      cuentaAbierta(estado, accion.cuentaId).comensales = accion.comensales;
      break;
    case "aplicar_descuento": {
      soloQuienPuede(estado, empleado);
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      cuenta.descuento = accion.descuento;
      if (accion.importe !== undefined) {
        if (accion.importe) cuenta.descuentoImporte = accion.importe;
        else delete cuenta.descuentoImporte;
      }
      if (cuenta.descuentoImporte) {
        const conPorcentaje = aplicarDescuento(subtotalCuenta(cuenta), cuenta.descuento);
        if (cuenta.descuentoImporte > conPorcentaje)
          falla(
            `El descuento no puede pasar de lo que queda por cobrar (${euros(conPorcentaje)}).`,
          );
      }
      break;
    }
    case "ajustar_lineas": {
      soloQuienPuede(estado, empleado);
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const lineas = lineasCobrables(cuenta).filter((l) => accion.lineaIds.includes(l.id));
      if (lineas.length !== accion.lineaIds.length)
        falla("Alguna de esas líneas ya está pagada o anulada.");
      for (const l of lineas) {
        const cambio = accion.cambio;
        if (cambio.tipo === "precio") {
          if (cambio.precio === precioConOpciones(l)) delete l.precioCambiado;
          else l.precioCambiado = cambio.precio;
        } else if (cambio.tipo === "descuento") {
          if (cambio.porcentaje) l.descuentoLinea = cambio.porcentaje;
          else delete l.descuentoLinea;
        } else {
          delete l.precioCambiado;
          delete l.descuentoLinea;
        }
      }
      // Si con los cambios el descuento en euros pasa del total, se ajusta.
      if (cuenta.descuentoImporte) {
        const conPorcentaje = aplicarDescuento(subtotalCuenta(cuenta), cuenta.descuento);
        if (cuenta.descuentoImporte > conPorcentaje) cuenta.descuentoImporte = conPorcentaje;
      }
      break;
    }
    case "mover_cuenta": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      if (cuenta.llevar) falla("Un pedido para llevar no se puede pasar a una mesa.");
      const destino = buscar(estado.mesas, accion.mesaId, "la mesa de destino");
      if (destino.id === cuenta.mesaId) falla("La cuenta ya está en esa mesa.");
      const yaAbierta = cuentaDeMesa(estado, destino.id);
      const origen = cuenta.mesaId;
      if (yaAbierta) {
        // Juntar mesas: todo pasa a la cuenta de destino.
        yaAbierta.lineas.push(...cuenta.lineas);
        yaAbierta.comensales += cuenta.comensales;
        yaAbierta.rondas = Math.max(yaAbierta.rondas, cuenta.rondas);
        cuenta.lineas = [];
        cuenta.estado = "anulada";
        cuenta.cerradaEn = ctx.ahora;
      } else {
        cuenta.mesaId = destino.id;
      }
      for (const a of estado.avisos) if (a.mesaId === origen && !a.atendido) a.mesaId = destino.id;
      break;
    }
    case "imprimir_precuenta": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const mesa = mesaDeCuenta(estado, cuenta);
      encolar(
        estado,
        ctx,
        trabajos,
        "precuenta",
        `Cuenta · ${mesa.nombre}`,
        plantillaPrecuenta({ ajustes: estado.ajustes, mesa, cuenta, fecha: ctx.ahora }),
        "tickets",
      );
      break;
    }
    case "cobrar": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      if (cuenta.lineas.some((l) => l.estado === "por_confirmar"))
        falla("Hay un pedido del QR sin aceptar. Acéptalo o recházalo antes de cobrar.");
      if (cuenta.lineas.some((l) => l.estado === "anotada"))
        falla("Hay líneas anotadas sin mandar. Mándalas o quítalas antes de cobrar.");
      if (accion.propina) apagada(estado, "propinas");
      let seleccion = lineasCobrables(cuenta);
      if (accion.partes) {
        apagada(estado, "cobrarPorPartes");
        seleccion = [];
        for (const parte of accion.partes) {
          const linea = lineasCobrables(cuenta).find((l) => l.id === parte.lineaId);
          if (!linea) falla("Alguna de esas líneas ya está pagada o anulada.");
          if (parte.cantidad > linea.cantidad)
            falla(`De ${linea.nombre} solo quedan ${linea.cantidad}.`);
          if (parte.cantidad < linea.cantidad) {
            // Se paga una parte: la línea se parte en dos (lo que se paga y lo que queda).
            linea.cantidad -= parte.cantidad;
            const pagada: LineaCuenta = { ...linea, id: ctx.nuevoId(), cantidad: parte.cantidad };
            cuenta.lineas.splice(cuenta.lineas.indexOf(linea) + 1, 0, pagada);
            seleccion.push(pagada);
          } else seleccion.push(linea);
        }
      }
      if (!seleccion.length) falla("No hay nada pendiente de cobrar.");
      cobrarLineas(
        estado,
        ctx,
        trabajos,
        cuenta,
        seleccion,
        accion.pagos,
        accion.propina ?? 0,
        empleado,
        true,
      );
      break;
    }
    case "venta_rapida": {
      apagada(estado, "ventaRapida");
      if (accion.propina) apagada(estado, "propinas");
      const cuenta: Cuenta = {
        id: ctx.nuevoId(),
        mesaId: MESA_VENTA_RAPIDA,
        estado: "abierta",
        comensales: 1,
        abiertaEn: ctx.ahora,
        cerradaEn: null,
        empleadoId: empleado.id,
        lineas: crearLineas(
          estado,
          accion.lineas.map((l) => ({ ...l, despues: false })),
          ctx,
          {
            estado: "anotada",
            origen: "camarero",
            empleadoId: empleado.id,
            ronda: 0,
            enviadaEn: null,
          },
          empleado.rol,
        ),
        descuento: 0,
        rondas: 0,
        ticketId: null,
      };
      estado.cuentas.push(cuenta);
      mandarRonda(estado, ctx, trabajos, cuenta, cuenta.lineas, empleado.id);
      // Lo de cocina sigue en su pantalla hasta que lo saquen, aunque ya esté pagado.
      cobrarLineas(
        estado,
        ctx,
        trabajos,
        cuenta,
        lineasCobrables(cuenta),
        accion.pagos,
        accion.propina ?? 0,
        empleado,
        false,
      );
      break;
    }
    case "marchar": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const enEspera = cuenta.lineas.filter((l) => l.estado === "en_espera");
      if (!enEspera.length) falla("No hay nada esperando la marcha.");
      for (const l of enEspera) {
        l.estado = "enviada";
        l.enviadaEn = ctx.ahora;
      }
      if (estado.ajustes.imprimirComandas ?? true)
        imprimirComandas(estado, ctx, trabajos, cuenta, enEspera, empleado.id, true);
      break;
    }
    case "cambiar_despues": {
      const linea = buscar(
        cuentaAbierta(estado, accion.cuentaId).lineas,
        accion.lineaId,
        "esa línea",
      );
      soloEditable(linea);
      if (accion.despues) linea.despues = true;
      else delete linea.despues;
      break;
    }
    case "anular_cuenta": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const mandadas = cuenta.lineas.some(
        (l) => !["anotada", "anulada", "por_confirmar"].includes(l.estado),
      );
      if (mandadas && empleado.rol !== "encargado")
        falla("Esta mesa ya tiene cosas en cocina o barra. Solo un encargado puede anularla.");
      for (const l of cuenta.lineas) {
        if (l.estado !== "anulada") {
          if (mandada(l))
            apuntarIncidencia(estado, ctx, "anulacion", l, empleado, "Cuenta anulada");
          l.estado = "anulada";
          l.motivoAnulacion = `Cuenta anulada (${empleado.nombre})`;
        }
      }
      cuenta.estado = "anulada";
      cuenta.cerradaEn = ctx.ahora;
      devolver(estado, cuenta.lineas);
      atenderAvisos(estado, cuenta.mesaId, ["llamar", "cuenta", "listo", "pedido_qr"]);
      break;
    }
    case "reimprimir_ticket": {
      const ticket = buscar(estado.tickets, accion.ticketId, "ese ticket");
      imprimirTicket(estado, ctx, trabajos, ticket, false);
      break;
    }
    case "rectificar_ticket": {
      if (empleado.rol !== "encargado") falla("Solo un encargado puede rectificar un ticket.");
      const original = buscar(estado.tickets, accion.ticketId, "ese ticket");
      if (original.rectificaA) falla("Una rectificativa no se puede rectificar.");
      if (estado.tickets.some((t) => t.rectificaA === original.id))
        falla("Este ticket ya está rectificado.");
      const sig = siguienteTicket(estado, ctx);
      const total = -original.total;
      const desglose = original.desglose.map((d) => ({
        tipo: d.tipo,
        base: -d.base,
        cuota: -d.cuota,
        total: -d.total,
      }));
      // El original ya está sellado: se quitan su huella, su tipo y su QR para sellarla de nuevo.
      const { huella: _h, tipoFactura: _t, generadoEn: _g, urlQr: _q, ...base } = original;
      void [_h, _t, _g, _q];
      const ticket = sellarTicket(
        estado,
        {
          ...base,
          id: ctx.nuevoId(),
          ...sig,
          fecha: ctx.ahora,
          lineas: original.lineas.map((l) => ({
            ...l,
            cantidad: -l.cantidad,
            importe: -l.importe,
          })),
          desglose,
          total,
          // Se devuelve por el mismo medio (si se pagó con cambio, se devuelve lo que se quedó).
          pagos: original.pagos.map((p) => ({
            ...p,
            importe: -(p.metodo === "efectivo" ? p.importe - original.cambio : p.importe),
          })),
          cambio: 0,
          ...(original.propina ? { propina: -original.propina } : {}),
          rectificaA: original.id,
          empleadoId: empleado.id,
        },
        ctx.ahora,
        ctx.entornoAeat,
      );
      imprimirTicket(estado, ctx, trabajos, ticket, false);
      break;
    }
    case "atender_aviso": {
      buscar(estado.avisos, accion.avisoId, "ese aviso").atendido = true;
      break;
    }
    case "cambiar_disponible": {
      const producto = buscar(estado.productos, accion.productoId, "ese producto");
      producto.disponible = accion.disponible;
      if (accion.oculto !== undefined) {
        if (empleado.rol !== "encargado") falla("Solo el encargado puede ocultar productos.");
        if (accion.oculto) producto.oculto = true;
        else delete producto.oculto;
      }
      // A mano manda la persona; si no hay stock, la próxima venta lo vuelve a agotar.
      delete producto.agotadoPorStock;
      break;
    }
    case "abrir_para_llevar": {
      apagada(estado, "paraLlevar");
      if (accion.cuentaId && estado.cuentas.some((c) => c.id === accion.cuentaId))
        falla("Esa cuenta ya existe.");
      abrirParaLlevar(estado, ctx, {
        id: accion.cuentaId,
        nombre: accion.nombre,
        telefono: accion.telefono,
        recogida: accion.recogida,
        online: false,
        empleadoId: empleado.id,
      });
      break;
    }
    case "guardar_reserva": {
      apagada(estado, "reservas");
      const { id, ...datos } = accion.reserva;
      if (datos.mesaId) buscar(estado.mesas, datos.mesaId, "esa mesa");
      if (id) {
        const reserva = buscar(estado.reservas, id, "esa reserva");
        Object.assign(reserva, datos);
      } else {
        if (datos.dia < diaLocal(ctx.ahora)) falla("Ese día ya ha pasado.");
        estado.reservas.push({
          id: ctx.nuevoId(),
          ...datos,
          estado: "confirmada",
          online: false,
          creadaEn: ctx.ahora,
        });
      }
      podarReservas(estado, ctx);
      break;
    }
    case "cambiar_reserva": {
      apagada(estado, "reservas");
      const reserva = buscar(estado.reservas, accion.reservaId, "esa reserva");
      if (reserva.estado === "sentada") falla("Ya están sentados: la reserva está cumplida.");
      reserva.estado = accion.estado;
      break;
    }
    case "sentar_reserva": {
      apagada(estado, "reservas");
      const reserva = buscar(estado.reservas, accion.reservaId, "esa reserva");
      if (reserva.estado === "sentada") falla("Esta reserva ya está sentada.");
      if (reserva.estado === "cancelada") falla("Esta reserva está cancelada.");
      buscar(estado.mesas, accion.mesaId, "la mesa");
      const cuenta = cuentaDeMesa(estado, accion.mesaId);
      if (cuenta) cuenta.comensales = Math.max(cuenta.comensales, reserva.personas);
      else
        estado.cuentas.push({
          id: ctx.nuevoId(),
          mesaId: accion.mesaId,
          estado: "abierta",
          comensales: reserva.personas,
          abiertaEn: ctx.ahora,
          cerradaEn: null,
          empleadoId: empleado.id,
          lineas: [],
          descuento: 0,
          rondas: 0,
          ticketId: null,
        });
      reserva.estado = "sentada";
      reserva.mesaId = accion.mesaId;
      break;
    }
    case "guardar_cliente": {
      apagada(estado, "club");
      const { id, ...datos } = accion.cliente;
      const tel = telefonoLimpio(datos.telefono);
      const repetido = estado.clientes.find(
        (c) => c.id !== id && telefonoLimpio(c.telefono) === tel,
      );
      if (repetido) falla(`Ese teléfono ya es de ${repetido.nombre}, que ya está en el club.`);
      if (id) Object.assign(buscar(estado.clientes, id, "ese cliente"), datos);
      else {
        if (!accion.consentimiento)
          falla("Para apuntarle hace falta que acepte que guardemos sus datos para el club.");
        const cliente = nuevoCliente(estado, ctx, datos, "personal");
        estado.clientes.push(cliente);
        if (accion.asignarA) cuentaAbierta(estado, accion.asignarA).clienteId = cliente.id;
      }
      break;
    }
    case "asignar_cliente": {
      apagada(estado, "club");
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      quitarCanje(cuenta);
      if (accion.clienteId) {
        buscar(estado.clientes, accion.clienteId, "ese cliente");
        cuenta.clienteId = accion.clienteId;
      } else delete cuenta.clienteId;
      break;
    }
    case "canjear_puntos": {
      apagada(estado, "club");
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      if (!accion.canjear) {
        quitarCanje(cuenta);
        break;
      }
      const reglas = reglasClub(estado);
      const cliente = estado.clientes.find((c) => c.id === cuenta.clienteId);
      if (!cliente) falla("Primero di de quién es la cuenta.");
      if (cuenta.canje) falla("El premio ya está aplicado en esta cuenta.");
      if (cliente.puntos < reglas.puntosPremio)
        falla(`Le faltan ${reglas.puntosPremio - cliente.puntos} puntos para el premio.`);
      if (totalCuenta(cuenta) < reglas.valorPremio)
        falla(`La cuenta tiene que ser de al menos ${euros(reglas.valorPremio)}.`);
      cuenta.canje = { puntos: reglas.puntosPremio, importe: reglas.valorPremio };
      break;
    }
    case "fichar": {
      apagada(estado, "fichajes");
      const abierta = jornadaAbierta(estado.fichajes, empleado.id, ctx.ahora);
      const pausa = abierta?.pausas.find((p) => !p.fin);
      if (accion.que === "entrada") {
        if (abierta) falla(`Ya fichaste la entrada (${formatearHora(abierta.entrada)}).`);
        estado.fichajes.push({
          id: ctx.nuevoId(),
          empleadoId: empleado.id,
          entrada: ctx.ahora,
          salida: null,
          pausas: [],
        });
        break;
      }
      if (!abierta) falla("No has fichado la entrada.");
      if (accion.que === "pausa") {
        if (pausa) falla("Ya estás en el descanso.");
        abierta.pausas.push({ inicio: ctx.ahora, fin: null });
      } else if (accion.que === "vuelta") {
        if (!pausa) falla("No estás en el descanso.");
        pausa.fin = ctx.ahora;
      } else {
        if (pausa) pausa.fin = ctx.ahora;
        abierta.salida = ctx.ahora;
      }
      break;
    }
    case "ajustar_stock": {
      apagada(estado, "stock");
      const ing = buscar(estado.ingredientes, accion.ingredienteId, "ese ingrediente");
      const nueva =
        accion.ajuste === "recuento" ? accion.cantidad : ing.existencias - accion.cantidad;
      const diferencia = redondear(nueva - ing.existencias);
      if (accion.ajuste === "merma" && accion.cantidad <= 0) falla("¿Cuánto se ha tirado?");
      ing.existencias = redondear(nueva);
      apuntarMovimiento(estado, ctx, {
        ingredienteId: ing.id,
        tipo: accion.ajuste,
        cantidad: diferencia,
        nota: accion.nota,
        empleadoId: empleado.id,
      });
      revisarAgotados(estado);
      break;
    }
    case "abrir_caja": {
      if (turnoAbierto(estado)) falla("La caja ya está abierta.");
      estado.turnos.push({
        id: ctx.nuevoId(),
        numero: estado.turnos.reduce((m, t) => Math.max(m, t.numero), 0) + 1,
        abiertoEn: ctx.ahora,
        cerradoEn: null,
        fondoInicial: accion.fondoInicial,
        movimientos: [],
        efectivoContado: null,
        abiertoPor: empleado.id,
        cerradoPor: null,
      });
      break;
    }
    case "movimiento_caja": {
      const turno = turnoAbierto(estado) ?? falla("La caja está cerrada.");
      turno.movimientos.push({
        id: ctx.nuevoId(),
        fecha: ctx.ahora,
        tipo: accion.movimiento,
        importe: accion.importe,
        motivo: accion.motivo,
        empleadoId: empleado.id,
      });
      break;
    }
    case "cerrar_caja": {
      const turno = turnoAbierto(estado) ?? falla("La caja ya está cerrada.");
      turno.cerradoEn = ctx.ahora;
      turno.cerradoPor = empleado.id;
      turno.efectivoContado = accion.efectivoContado;
      encolar(
        estado,
        ctx,
        trabajos,
        "cierre",
        `Cierre Z nº ${turno.numero}`,
        plantillaCierre({ ajustes: estado.ajustes, estado, turno }),
        "tickets",
      );
      break;
    }
    case "reimprimir_cierre": {
      const turno = buscar(estado.turnos, accion.turnoId, "ese turno");
      encolar(
        estado,
        ctx,
        trabajos,
        "cierre",
        `Cierre Z nº ${turno.numero}`,
        plantillaCierre({ ajustes: estado.ajustes, estado, turno }),
        "tickets",
      );
      break;
    }
    case "reintentar_trabajo": {
      const previo = buscar(estado.trabajos, accion.trabajoId, "ese trabajo");
      const impresora = estado.impresoras.find((i) => i.id === previo.impresoraId);
      if (impresora?.conexion !== "red") falla("Este trabajo se imprime desde el navegador.");
      const { error: _error, ...resto } = previo;
      void _error;
      const trabajo: TrabajoImpresion = { ...resto, estado: "pendiente" };
      estado.trabajos = estado.trabajos.map((t) => (t.id === trabajo.id ? trabajo : t));
      trabajos.push(trabajo);
      break;
    }
    default:
      return reducirEncargado(estado, accion, empleado, ctx, trabajos);
  }
  return { estado, trabajos };
}

function reducirEncargado(
  estado: Estado,
  accion: AccionEncargado,
  empleado: Empleado,
  ctx: Contexto,
  trabajos: TrabajoImpresion[],
): Resultado {
  if (empleado.rol !== "encargado") falla("Esto solo lo puede hacer un encargado.");
  switch (accion.tipo) {
    case "guardar_gasto": {
      const { id, ...datos } = accion.gasto;
      if (id) {
        const gasto = buscar(estado.gastos, id, "ese gasto");
        Object.assign(gasto, datos);
      } else {
        apuntarGasto(estado, ctx, { ...datos, empleadoId: empleado.id });
      }
      break;
    }
    case "borrar_gasto":
      buscar(estado.gastos, accion.gastoId, "ese gasto");
      estado.gastos = estado.gastos.filter((g) => g.id !== accion.gastoId);
      break;
    case "guardar_categoria": {
      const { id, ...datos } = accion.categoria;
      if (id) Object.assign(buscar(estado.categorias, id, "esa categoría"), datos);
      else estado.categorias.push({ id: ctx.nuevoId(), ...datos });
      break;
    }
    case "borrar_categoria":
      if (estado.productos.some((p) => p.categoriaId === accion.categoriaId))
        falla("Esta categoría tiene productos. Muévelos o bórralos antes.");
      estado.categorias = estado.categorias.filter((c) => c.id !== accion.categoriaId);
      break;
    case "guardar_producto": {
      const { id, receta, ...datos } = accion.producto;
      buscar(estado.categorias, datos.categoriaId, "esa categoría");
      for (const r of receta ?? []) buscar(estado.ingredientes, r.ingredienteId, "ese ingrediente");
      const producto = id
        ? Object.assign(buscar(estado.productos, id, "ese producto"), datos)
        : estado.productos[estado.productos.push({ id: ctx.nuevoId(), ...datos }) - 1]!;
      if (receta?.length) producto.receta = receta;
      else delete producto.receta;
      if (producto.disponible) delete producto.agotadoPorStock;
      revisarAgotados(estado);
      break;
    }
    case "guardar_ingrediente": {
      apagada(estado, "stock");
      const { id, existencias, pedirHasta, ...datos } = accion.ingrediente;
      const repetido = estado.ingredientes.find(
        (i) => i.id !== id && i.nombre.toLowerCase() === datos.nombre.toLowerCase(),
      );
      if (repetido) falla(`Ya hay un ingrediente que se llama «${datos.nombre}».`);
      const ing = id
        ? Object.assign(buscar(estado.ingredientes, id, "ese ingrediente"), datos)
        : estado.ingredientes[
            estado.ingredientes.push({
              id: ctx.nuevoId(),
              ...datos,
              existencias: redondear(existencias ?? 0),
            }) - 1
          ]!;
      if (pedirHasta) ing.pedirHasta = pedirHasta;
      else delete ing.pedirHasta;
      revisarAgotados(estado);
      break;
    }
    case "borrar_ingrediente": {
      buscar(estado.ingredientes, accion.ingredienteId, "ese ingrediente");
      estado.ingredientes = estado.ingredientes.filter((i) => i.id !== accion.ingredienteId);
      for (const p of estado.productos) {
        if (!p.receta) continue;
        p.receta = p.receta.filter((r) => r.ingredienteId !== accion.ingredienteId);
        if (!p.receta.length) delete p.receta;
      }
      revisarAgotados(estado);
      break;
    }
    case "recibir_compra": {
      apagada(estado, "stock");
      const lineas = accion.lineas.map((l) => ({
        ...l,
        ingrediente: buscar(estado.ingredientes, l.ingredienteId, "ese ingrediente"),
      }));
      const total = lineas.reduce((s, l) => s + l.importe, 0);
      const proveedor = accion.proveedor || lineas[0]!.ingrediente.proveedor;
      let gastoId: string | undefined;
      if (accion.apuntarGasto) {
        if (!total) falla("Pon lo que ha costado para apuntar el gasto.");
        const nombres = [...new Set(lineas.map((l) => l.ingrediente.nombre))];
        gastoId = apuntarGasto(estado, ctx, {
          fecha: ctx.ahora,
          concepto: `Pedido: ${nombres.join(", ")}`.slice(0, 120),
          categoria: "proveedores",
          proveedor,
          importe: total,
          iva: accion.iva,
          metodo: accion.metodo,
          deCaja: accion.deCaja,
          empleadoId: empleado.id,
        }).id;
      }
      for (const l of lineas) {
        l.ingrediente.existencias = redondear(l.ingrediente.existencias + l.cantidad);
        // El precio que vale para los escandallos es el de la última compra.
        if (l.importe) l.ingrediente.coste = Math.round(l.importe / l.cantidad);
        if (proveedor && !l.ingrediente.proveedor) l.ingrediente.proveedor = proveedor;
        apuntarMovimiento(estado, ctx, {
          ingredienteId: l.ingrediente.id,
          tipo: "compra",
          cantidad: l.cantidad,
          nota: proveedor,
          empleadoId: empleado.id,
          ...(gastoId ? { gastoId } : {}),
        });
      }
      revisarAgotados(estado);
      break;
    }
    case "borrar_producto":
      // Las cuentas guardan copia del nombre y el precio, así que no se pierde nada.
      estado.productos = estado.productos.filter((p) => p.id !== accion.productoId);
      break;
    case "guardar_zona": {
      const { id, ...datos } = accion.zona;
      if (id) Object.assign(buscar(estado.zonas, id, "esa zona"), datos);
      else estado.zonas.push({ id: ctx.nuevoId(), ...datos });
      break;
    }
    case "borrar_zona":
      if (estado.mesas.some((m) => m.zonaId === accion.zonaId))
        falla("Esta zona tiene mesas. Muévelas o bórralas antes.");
      estado.zonas = estado.zonas.filter((z) => z.id !== accion.zonaId);
      break;
    case "guardar_mesa": {
      const { id, ...datos } = accion.mesa;
      buscar(estado.zonas, datos.zonaId, "esa zona");
      const repetida = estado.mesas.find(
        (m) => m.id !== id && m.nombre.toLowerCase() === datos.nombre.toLowerCase(),
      );
      if (repetida) falla(`Ya hay una mesa que se llama «${datos.nombre}».`);
      if (id) Object.assign(buscar(estado.mesas, id, "esa mesa"), datos);
      else
        estado.mesas.push({ id: ctx.nuevoId(), token: ctx.nuevoToken(), ...datos } satisfies Mesa);
      break;
    }
    case "borrar_mesa":
      if (cuentaDeMesa(estado, accion.mesaId)) falla("Esta mesa tiene una cuenta abierta.");
      estado.mesas = estado.mesas.filter((m) => m.id !== accion.mesaId);
      break;
    case "regenerar_qr":
      buscar(estado.mesas, accion.mesaId, "esa mesa").token = ctx.nuevoToken();
      break;
    case "guardar_empleado": {
      const { id, ...cambios } = accion.empleado;
      const previo = id ? buscar(estado.empleados, id, "esa persona") : undefined;
      const datos = {
        ...cambios,
        pin: cambios.pin
          ? resumenPin(cambios.pin)
          : (previo?.pin ?? falla("Ponle un PIN de 4 a 6 cifras.")),
      };
      const pinRepetido = estado.empleados.find(
        (e) => e.id !== id && e.activo && e.pin === datos.pin,
      );
      if (pinRepetido && datos.activo) falla("Ese PIN ya lo usa otra persona.");
      const nuevos = id
        ? estado.empleados.map((e) => (e.id === id ? { ...e, ...datos } : e))
        : [...estado.empleados, { id: ctx.nuevoId(), ...datos }];
      comprobarEncargado(nuevos);
      estado.empleados = nuevos;
      break;
    }
    case "guardar_ajustes": {
      // Las funciones se cambian aparte: guardar los datos del local no las toca.
      // Sin el campo, se queda el enlace de reseñas que había; vacío, se quita.
      // Lo que no venga (pantallas antiguas) se queda como estaba.
      const { enlaceResena, ...datos } = accion.ajustes;
      const enlace = enlaceResena ?? estado.ajustes.enlaceResena;
      const { enlaceResena: _antes, ...previos } = estado.ajustes;
      void _antes;
      estado.ajustes = {
        ...previos,
        ...datos,
        funciones: estado.ajustes.funciones,
        ...(enlace ? { enlaceResena: enlace } : {}),
      };
      break;
    }
    case "cambiar_funcion":
      estado.ajustes.funciones = { ...estado.ajustes.funciones, [accion.funcion]: accion.activa };
      // Al apagar el stock, lo que había agotado vuelve a la carta (y al revés).
      if (accion.funcion === "stock") revisarAgotados(estado);
      break;
    case "guardar_impresora": {
      const { id, ...datos } = accion.impresora;
      if (datos.conexion === "red" && !datos.ip) falla("Pon la IP de la impresora.");
      if (id) Object.assign(buscar(estado.impresoras, id, "esa impresora"), datos);
      else estado.impresoras.push({ id: ctx.nuevoId(), ...datos });
      break;
    }
    case "borrar_impresora":
      estado.impresoras = estado.impresoras.filter((i) => i.id !== accion.impresoraId);
      break;
    case "corregir_fichaje": {
      buscar(estado.empleados, accion.empleadoId, "esa persona");
      const datos = { entrada: accion.entrada, salida: accion.salida, pausas: accion.pausas };
      if (datos.salida && datos.salida <= datos.entrada)
        falla("La salida tiene que ser después de la entrada.");
      if (datos.salida && Date.parse(datos.salida) - Date.parse(datos.entrada) > 24 * 3_600_000)
        falla("Una jornada no puede pasar de 24 horas.");
      for (const p of datos.pausas) {
        if (p.inicio < datos.entrada || (datos.salida && (p.fin ?? p.inicio) > datos.salida))
          falla("Los descansos tienen que caer dentro de la jornada.");
        if (p.fin && p.fin < p.inicio) falla("Un descanso acaba antes de empezar.");
      }
      if (datos.entrada > ctx.ahora || (datos.salida && datos.salida > ctx.ahora))
        falla("No se pueden fichar horas que aún no han pasado.");
      const cambio = { en: ctx.ahora, por: empleado.id, motivo: accion.motivo };
      if (accion.fichajeId) {
        const f = buscar(estado.fichajes, accion.fichajeId, "ese fichaje");
        if (f.empleadoId !== accion.empleadoId) falla("Ese fichaje es de otra persona.");
        const antes = { entrada: f.entrada, salida: f.salida, pausas: f.pausas };
        Object.assign(f, datos);
        f.cambios = [...(f.cambios ?? []), { ...cambio, antes }];
      } else {
        const f: Fichaje = {
          id: ctx.nuevoId(),
          empleadoId: accion.empleadoId,
          ...datos,
          cambios: [{ ...cambio, antes: null }],
        };
        estado.fichajes.push(f);
      }
      break;
    }
    case "guardar_turno": {
      apagada(estado, "cuadrante");
      const { id, ...datos } = accion.turno;
      buscar(estado.empleados, datos.empleadoId, "esa persona");
      if (datos.desde === datos.hasta) falla("El turno tiene que durar algo.");
      if (id) Object.assign(buscar(estado.cuadrante, id, "ese turno"), datos);
      else estado.cuadrante.push({ id: ctx.nuevoId(), ...datos });
      podarCuadrante(estado, ctx);
      break;
    }
    case "borrar_turno":
      buscar(estado.cuadrante, accion.turnoId, "ese turno");
      estado.cuadrante = estado.cuadrante.filter((t) => t.id !== accion.turnoId);
      break;
    case "baja_cliente": {
      const cliente = buscar(estado.clientes, accion.clienteId, "ese cliente");
      estado.clientes = estado.clientes.filter((c) => c.id !== cliente.id);
      for (const c of estado.cuentas)
        if (c.estado === "abierta" && c.clienteId === cliente.id) {
          quitarCanje(c);
          delete c.clienteId;
        }
      break;
    }
    case "reglas_club":
      estado.ajustes.club = accion.reglas;
      break;
    case "copiar_semana": {
      apagada(estado, "cuadrante");
      const origen = diasDeSemana(lunesDe(accion.desde));
      const destino = diasDeSemana(lunesDe(accion.hacia));
      if (origen[0] === destino[0]) falla("Elige otra semana.");
      const copiados = estado.cuadrante
        .filter((t) => origen.includes(t.dia))
        .map((t) => ({ ...t, id: ctx.nuevoId(), dia: destino[origen.indexOf(t.dia)]! }))
        .filter(
          (n) =>
            !estado.cuadrante.some(
              (t) =>
                t.empleadoId === n.empleadoId &&
                t.dia === n.dia &&
                t.desde === n.desde &&
                t.hasta === n.hasta,
            ),
        );
      if (!copiados.length) falla("No hay turnos nuevos que copiar.");
      estado.cuadrante.push(...copiados);
      podarCuadrante(estado, ctx);
      break;
    }
    case "crear_codigo_vinculo": {
      const vigentes = (estado.vinculos ?? []).filter((v) => v.caduca > ctx.ahora);
      const caduca = new Date(Date.parse(ctx.ahora) + 15 * 60_000).toISOString();
      estado.vinculos = [...vigentes, { codigo: ctx.nuevoCodigo(), caduca }].slice(-5);
      break;
    }
    case "imprimir_prueba": {
      const imp = buscar(estado.impresoras, accion.impresoraId, "esa impresora");
      encolar(
        estado,
        ctx,
        trabajos,
        "prueba",
        `Prueba · ${imp.nombre}`,
        plantillaPrueba(imp.nombre, ctx.ahora),
        {
          impresoraId: imp.id,
        },
      );
      break;
    }
  }
  return { estado, trabajos };
}

/** El enlace para dejar una reseña, si el bar la pide. */
export function enlaceResena(estado: Pick<Estado, "ajustes">): string | undefined {
  return activa(estado.ajustes, "resenas") ? estado.ajustes.enlaceResena : undefined;
}

/** Quita el premio del club de una cuenta (y su descuento). */
function quitarCanje(cuenta: Cuenta) {
  delete cuenta.canje;
}

function nuevoCliente(
  estado: Estado,
  ctx: Contexto,
  datos: Pick<ClienteClub, "nombre" | "telefono" | "correo" | "alergenos" | "comunicaciones"> &
    Partial<Pick<ClienteClub, "nota">>,
  via: "qr" | "personal",
): ClienteClub {
  return {
    id: ctx.nuevoId(),
    codigo: ctx.nuevoToken(),
    ...datos,
    nota: datos.nota ?? "",
    consentimiento: { fecha: ctx.ahora, via },
    altaEn: ctx.ahora,
    puntos: reglasClub(estado).bienvenida,
    visitas: 0,
    gastado: 0,
    ultimaVisita: null,
    favoritos: {},
    historial: [],
  };
}

/** Si el bar lo ha decidido así, solo el encargado cambia precios y hace descuentos. */
function soloQuienPuede(estado: Estado, empleado: Empleado) {
  if (estado.ajustes.preciosSoloEncargado && empleado.rol !== "encargado")
    falla("En este bar, los precios y descuentos los cambia el encargado.");
}

/** Corta la acción si la función está apagada en este bar. */
function apagada(estado: Estado, funcion: Funcion) {
  if (!activa(estado.ajustes, funcion))
    falla(`«${FUNCIONES[funcion].nombre}» está apagado. Se enciende en Gestión → Funciones.`);
}

/** La línea ya había salido hacia cocina o barra (anularla es una anulación de verdad). */
function mandada(linea: LineaCuenta) {
  return !["anotada", "por_confirmar", "anulada"].includes(linea.estado);
}

function apuntarIncidencia(
  estado: Estado,
  ctx: Contexto,
  tipo: Incidencia["tipo"],
  linea: LineaCuenta,
  empleado: Empleado,
  motivo: string,
) {
  estado.incidencias.push({
    id: ctx.nuevoId(),
    fecha: ctx.ahora,
    tipo,
    lineaId: linea.id,
    empleadoId: empleado.id,
    anotadaPor: linea.empleadoId,
    producto: linea.nombre,
    cantidad: linea.cantidad,
    importe:
      linea.invitacion && tipo === "anulacion" ? 0 : importeLinea({ ...linea, invitacion: false }),
    motivo,
  });
  if (estado.incidencias.length > MAX_INCIDENCIAS)
    estado.incidencias.splice(0, estado.incidencias.length - MAX_INCIDENCIAS);
}

/** El cuadrante solo guarda los últimos meses y lo que viene. */
function podarCuadrante(estado: Estado, ctx: Contexto) {
  const desde = sumarDias(ctx.ahora.slice(0, 10), -DIAS_CUADRANTE);
  estado.cuadrante = estado.cuadrante.filter((t) => t.dia >= desde);
}

/** Apunta un gasto nuevo; si se pagó con la caja abierta, sale como retirada en el arqueo. */
function apuntarGasto(estado: Estado, ctx: Contexto, datos: Omit<Gasto, "id">): Gasto {
  const gasto: Gasto = { id: ctx.nuevoId(), ...datos };
  estado.gastos.push(gasto);
  const turno = turnoAbierto(estado);
  if (datos.deCaja && turno) {
    turno.movimientos.push({
      id: ctx.nuevoId(),
      fecha: ctx.ahora,
      tipo: "salida",
      importe: datos.importe,
      motivo: `Gasto: ${datos.concepto}`,
      empleadoId: datos.empleadoId,
    });
  }
  return gasto;
}

function apuntarMovimiento(
  estado: Estado,
  ctx: Contexto,
  datos: Omit<MovimientoStock, "id" | "fecha">,
) {
  estado.movimientosStock.push({ id: ctx.nuevoId(), fecha: ctx.ahora, ...datos });
  if (estado.movimientosStock.length > MAX_MOVIMIENTOS_STOCK)
    estado.movimientosStock.splice(0, estado.movimientosStock.length - MAX_MOVIMIENTOS_STOCK);
}

/** Abre la cuenta de un pedido para llevar. Cada uno lleva su propia «mesa» (ver selectores). */
function abrirParaLlevar(
  estado: Estado,
  ctx: Contexto,
  datos: {
    id?: string;
    nombre: string;
    telefono: string;
    recogida: string;
    online: boolean;
    empleadoId: string | null;
    token?: string;
  },
): Cuenta {
  const id = datos.id ?? ctx.nuevoId();
  const cuenta: Cuenta = {
    id,
    mesaId: `${PREFIJO_LLEVAR}${id}`,
    llevar: {
      nombre: datos.nombre,
      telefono: datos.telefono,
      recogida: datos.recogida,
      online: datos.online,
      ...(datos.token ? { token: datos.token } : {}),
    },
    estado: "abierta",
    comensales: 1,
    abiertaEn: ctx.ahora,
    cerradaEn: null,
    empleadoId: datos.empleadoId,
    lineas: [],
    descuento: 0,
    rondas: 0,
    ticketId: null,
  };
  estado.cuentas.push(cuenta);
  return cuenta;
}

function podarReservas(estado: Estado, ctx: Contexto) {
  const desde = sumarDias(diaLocal(ctx.ahora), -DIAS_RESERVAS);
  estado.reservas = estado.reservas.filter((r) => r.dia >= desde);
}

/** Lo que hay detrás de un enlace de cliente: el QR de una mesa o un encargo para llevar. */
function porToken(estado: Estado, token: string): { mesaId: string; llevar?: Cuenta } {
  const mesa = estado.mesas.find((m) => m.token === token);
  if (mesa) return { mesaId: mesa.id };
  const llevar = estado.cuentas.find((c) => c.llevar?.token === token);
  if (llevar) return { mesaId: llevar.mesaId, llevar };
  return falla("Este QR ya no es válido. Pide uno nuevo al camarero.");
}

/** Aplica una acción que llega desde el QR de una mesa (o desde el enlace de un encargo). */
export function reducirCliente(
  anterior: Estado,
  mesaToken: string,
  accion: AccionCliente,
  ctx: Contexto,
): Resultado {
  const estado = copiaEditable(anterior);
  const trabajos: TrabajoImpresion[] = [];
  const { mesaId, llevar } = porToken(estado, mesaToken);

  switch (accion.tipo) {
    case "pedir": {
      if (!estado.ajustes.pedidosQRActivos)
        falla("Ahora mismo los pedidos se hacen con el camarero.");
      let cuenta = cuentaDeMesa(estado, mesaId);
      if (llevar && !cuenta) falla("Este encargo ya está cerrado. Si quieres algo más, haz otro.");
      if (!cuenta) {
        cuenta = {
          id: ctx.nuevoId(),
          mesaId,
          estado: "abierta",
          comensales: 1,
          abiertaEn: ctx.ahora,
          cerradaEn: null,
          empleadoId: null,
          lineas: [],
          descuento: 0,
          rondas: 0,
          ticketId: null,
        };
        estado.cuentas.push(cuenta);
      }
      const confirmar = estado.ajustes.confirmarPedidosQR;
      const lineas = crearLineas(
        estado,
        accion.lineas,
        ctx,
        { estado: "por_confirmar", origen: "qr", empleadoId: null, ronda: 0, enviadaEn: null },
        "qr",
      );
      cuenta.lineas.push(...lineas);
      if (confirmar) {
        const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
        avisar(
          estado,
          ctx,
          mesaId,
          "pedido_qr",
          `${unidades} ${unidades === 1 ? "cosa" : "cosas"} por aceptar`,
        );
      } else {
        mandarRonda(estado, ctx, trabajos, cuenta, lineas, null);
      }
      break;
    }
    case "llamar_camarero":
      if (llevar) falla("En los encargos no hay camarero de mesa: llama al bar si hace falta.");
      avisar(estado, ctx, mesaId, "llamar", "Quieren que vayas a la mesa");
      break;
    case "pedir_cuenta": {
      if (llevar) falla("El encargo se paga al recogerlo.");
      const cuenta =
        cuentaDeMesa(estado, mesaId) ?? falla("Todavía no hay nada que cobrar en esta mesa.");
      const como = { efectivo: "en efectivo", tarjeta: "con tarjeta", bizum: "con Bizum" }[
        accion.metodo
      ];
      avisar(estado, ctx, mesaId, "cuenta", `Pagará ${como} · ${euros(totalCuenta(cuenta))}`);
      break;
    }
    case "sumar_al_club": {
      if (!activa(estado.ajustes, "club")) falla("Este bar no tiene club de clientes.");
      const cliente =
        estado.clientes.find((c) => c.codigo === accion.codigo) ??
        falla("No encuentro tu tarjeta del club. Apúntate otra vez o pregunta en la barra.");
      const cuenta =
        cuentaDeMesa(estado, mesaId) ?? falla("Todavía no hay nada en la cuenta de esta mesa.");
      if (cuenta.clienteId && cuenta.clienteId !== cliente.id)
        falla("Esta cuenta ya suma puntos para otra persona de la mesa.");
      cuenta.clienteId = cliente.id;
      break;
    }
  }
  return { estado, trabajos };
}

/**
 * Un cliente se apunta al club desde su móvil (con su consentimiento). Si lo hace desde el QR de
 * una mesa con la cuenta abierta, esa cuenta ya suma puntos para él. Devuelve su código de
 * tarjeta.
 */
export function reducirAltaClub(
  anterior: Estado,
  datos: AltaClub,
  ctx: Contexto,
): Resultado & { codigo: string } {
  const estado = copiaEditable(anterior);
  if (!activa(estado.ajustes, "club")) falla("Este bar no tiene club de clientes.");
  const tel = telefonoLimpio(datos.telefono);
  if (estado.clientes.some((c) => telefonoLimpio(c.telefono) === tel))
    falla("Ese teléfono ya está en el club. Pide en la barra que te enseñen tu tarjeta.");
  const cliente = nuevoCliente(
    estado,
    ctx,
    {
      nombre: datos.nombre,
      telefono: datos.telefono,
      correo: datos.correo,
      alergenos: [],
      comunicaciones: datos.comunicaciones,
    },
    "qr",
  );
  estado.clientes.push(cliente);
  const mesa = datos.mesa ? estado.mesas.find((m) => m.token === datos.mesa) : undefined;
  const cuenta = mesa ? cuentaDeMesa(estado, mesa.id) : undefined;
  if (cuenta && !cuenta.clienteId) cuenta.clienteId = cliente.id;
  return { estado, trabajos: [], codigo: cliente.codigo };
}

/** Encargos online vacíos (abiertos y sin pedir nada) que se guardan como mucho. */
const MAX_ENCARGOS_VACIOS = 40;

/**
 * Un cliente empieza un encargo para llevar desde la web del bar. Devuelve el código de su
 * enlace: con él pide de la carta como si fuera una mesa y ve cómo va.
 */
export function reducirEncargoOnline(
  anterior: Estado,
  datos: EncargoOnline,
  ctx: Contexto,
): Resultado & { token: string } {
  const estado = copiaEditable(anterior);
  if (!activa(estado.ajustes, "pedidosOnline") || !activa(estado.ajustes, "paraLlevar"))
    falla("Este bar no acepta encargos por internet ahora mismo.");
  if (!estado.ajustes.pedidosQRActivos) falla("Ahora mismo los pedidos se hacen en el bar.");
  if (instante(diaLocal(ctx.ahora), datos.recogida) < ctx.ahora)
    falla("Esa hora ya ha pasado. Elige una más tarde.");
  // Los encargos que se empezaron y no se pidieron se olvidan a las 3 horas.
  const caducan = new Date(Date.parse(ctx.ahora) - 3 * 3_600_000).toISOString();
  const vacio = (c: Cuenta) => c.llevar?.online && c.estado === "abierta" && !c.lineas.length;
  estado.cuentas = estado.cuentas.filter((c) => !vacio(c) || c.abiertaEn > caducan);
  if (estado.cuentas.filter(vacio).length >= MAX_ENCARGOS_VACIOS)
    falla("Ahora mismo hay muchos encargos a medias. Prueba dentro de un rato.");
  const token = ctx.nuevoToken();
  abrirParaLlevar(estado, ctx, { ...datos, online: true, empleadoId: null, token });
  return { estado, trabajos: [], token };
}

/** Peticiones de reserva por confirmar que puede tener un mismo teléfono. */
const MAX_RESERVAS_POR_TELEFONO = 3;

/** Un cliente pide mesa desde la web del bar. Queda por confirmar. */
export function reducirReservaOnline(
  anterior: Estado,
  datos: ReservaOnline,
  ctx: Contexto,
): Resultado {
  const estado = copiaEditable(anterior);
  if (!activa(estado.ajustes, "reservasOnline") || !activa(estado.ajustes, "reservas"))
    falla("Este bar no coge reservas por internet. Llama por teléfono.");
  const hoy = diaLocal(ctx.ahora);
  if (instante(datos.dia, datos.hora) < ctx.ahora) falla("Esa hora ya ha pasado.");
  if (datos.dia > sumarDias(hoy, 60)) falla("Solo se reserva con dos meses de antelación.");
  const telefono = datos.telefono.replace(/\s/g, "");
  const suyas = estado.reservas.filter(
    (r) => r.estado === "por_confirmar" && r.telefono.replace(/\s/g, "") === telefono,
  );
  if (suyas.length >= MAX_RESERVAS_POR_TELEFONO)
    falla("Ya tienes reservas pendientes de confirmar. Te llamaremos enseguida.");
  const reserva: Reserva = {
    id: ctx.nuevoId(),
    ...datos,
    mesaId: null,
    estado: "por_confirmar",
    online: true,
    creadaEn: ctx.ahora,
  };
  estado.reservas.push(reserva);
  podarReservas(estado, ctx);
  return { estado, trabajos: [] };
}

/** Gasta un código de vinculación. Devuelve el estado sin ese código, o falla si no vale. */
export function usarCodigoVinculo(anterior: Estado, codigo: string, ahora: string): Estado {
  const vinculos = anterior.vinculos ?? [];
  if (!vinculos.some((v) => v.codigo === codigo && v.caduca > ahora))
    falla("Ese código no vale o ha caducado. Pide uno nuevo al encargado.");
  return { ...anterior, vinculos: vinculos.filter((v) => v.codigo !== codigo && v.caduca > ahora) };
}
