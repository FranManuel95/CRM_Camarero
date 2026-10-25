import type { AccionCliente, AccionEncargado, AccionPersonal, LineaPedida } from "./acciones";
import { turnoAbierto } from "./caja";
import { calcularHuella } from "./huella";
import { resumenPin } from "./pin";
import {
  calcularCambio,
  desgloseIva,
  euros,
  lineasCobrables,
  lineasDeTicket,
  totalCuenta,
  totalPagos,
} from "./importes";
import { dentroDeHorario } from "./horario";
import { lineasPara, MESA_VENTA_RAPIDA } from "./selectores";
import type {
  Aviso,
  Centimos,
  Cuenta,
  Destino,
  Empleado,
  Estado,
  LineaCuenta,
  Mesa,
  OpcionElegida,
  Pago,
  Producto,
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
};

export type Resultado = { estado: Estado; trabajos: TrabajoImpresion[] };

const MAX_TRABAJOS = 300;
const MAX_AVISOS_ATENDIDOS = 200;

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
  soloVisiblesEnQR = false,
): LineaCuenta[] {
  return pedidas.map((p) => {
    const producto = buscar(estado.productos, p.productoId, "ese producto");
    const categoria = estado.categorias.find((c) => c.id === producto.categoriaId);
    if (!producto.disponible) falla(`${producto.nombre} está agotado ahora mismo.`);
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
      ...(p.despues ? { despues: true } : {}),
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
) {
  if (!lineas.length) return;
  cuenta.rondas += 1;
  for (const l of lineas) {
    l.estado = l.despues ? "en_espera" : "enviada";
    l.enviadaEn = ctx.ahora;
    l.ronda = cuenta.rondas;
    if (!l.empleadoId) l.empleadoId = empleadoId;
  }
  imprimirComandas(estado, ctx, trabajos, cuenta, lineas, empleadoId);
}

/** La mesa de una cuenta (las ventas rápidas no tienen mesa de verdad). */
function mesaDeCuenta(estado: Estado, cuenta: Cuenta): Mesa {
  if (cuenta.mesaId === MESA_VENTA_RAPIDA) return MESA_RAPIDA;
  return buscar(estado.mesas, cuenta.mesaId, "la mesa");
}

const MESA_RAPIDA: Mesa = {
  id: MESA_VENTA_RAPIDA,
  nombre: "Venta rápida",
  zonaId: "",
  x: 0,
  y: 0,
  ancho: 0,
  alto: 0,
  forma: "cuadrada",
  plazas: 1,
  token: "",
};

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
  const parte = { lineas: seleccion, descuento: cuenta.descuento };
  const total = totalCuenta(parte);
  const aPagar = total + propina;
  const entregado = totalPagos(pagos);
  if (entregado < aPagar) falla(`Faltan ${euros(aPagar - entregado)} por cobrar.`);
  const cambio = calcularCambio(aPagar, pagos);
  if (entregado - aPagar > cambio) falla("Con tarjeta o Bizum no se puede cobrar de más.");
  const mesa = mesaDeCuenta(estado, cuenta);
  const lineas = lineasDeTicket(parte);
  const desglose = desgloseIva(lineas, cuenta.descuento);
  const sig = siguienteTicket(estado, ctx);
  const ticket: Ticket = {
    id: ctx.nuevoId(),
    ...sig,
    fecha: ctx.ahora,
    cuentaId: cuenta.id,
    mesaNombre: mesa.nombre,
    empleadoId: cuenta.empleadoId ?? empleado.id,
    lineas,
    descuento: cuenta.descuento,
    desglose,
    total,
    pagos: pagos.filter((p) => p.importe > 0),
    cambio,
    ...(propina ? { propina } : {}),
    rectificaA: null,
    huella: calcularHuella({
      nif: estado.ajustes.nif,
      numero: sig.numero,
      fecha: ctx.ahora,
      cuotaTotal: desglose.reduce((s, d) => s + d.cuota, 0),
      importeTotal: total,
      huellaAnterior: sig.huellaAnterior,
      generadoEn: ctx.ahora,
    }),
  };
  estado.tickets.push(ticket);
  for (const l of seleccion) l.ticketId = ticket.id;
  cuenta.ticketId = ticket.id;
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
  const estado = copiaEditable(anterior);
  const trabajos: TrabajoImpresion[] = [];

  switch (accion.tipo) {
    case "abrir_cuenta": {
      buscar(estado.mesas, accion.mesaId, "la mesa");
      if (cuentaDeMesa(estado, accion.mesaId)) falla("Esta mesa ya tiene una cuenta abierta.");
      estado.cuentas.push({
        id: ctx.nuevoId(),
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
      const nuevas = crearLineas(estado, accion.lineas, ctx, {
        estado: "anotada",
        origen: "camarero",
        empleadoId: empleado.id,
        ronda: 0,
        enviadaEn: null,
      });
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
      linea.estado = "anulada";
      linea.motivoAnulacion = `${accion.motivo} (${empleado.nombre})`;
      break;
    }
    case "invitar_linea": {
      const linea = buscar(
        cuentaAbierta(estado, accion.cuentaId).lineas,
        accion.lineaId,
        "esa línea",
      );
      linea.invitacion = accion.invitacion;
      break;
    }
    case "enviar_comanda": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
      const pendientes = cuenta.lineas.filter((l) => l.estado === "anotada");
      if (!pendientes.length) falla("No hay nada nuevo que mandar.");
      mandarRonda(estado, ctx, trabajos, cuenta, pendientes, empleado.id);
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
    case "aplicar_descuento":
      cuentaAbierta(estado, accion.cuentaId).descuento = accion.descuento;
      break;
    case "mover_cuenta": {
      const cuenta = cuentaAbierta(estado, accion.cuentaId);
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
      const mesa = buscar(estado.mesas, cuenta.mesaId, "la mesa");
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
      let seleccion = lineasCobrables(cuenta);
      if (accion.partes) {
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
          l.estado = "anulada";
          l.motivoAnulacion = `Cuenta anulada (${empleado.nombre})`;
        }
      }
      cuenta.estado = "anulada";
      cuenta.cerradaEn = ctx.ahora;
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
      const ticket: Ticket = {
        ...original,
        id: ctx.nuevoId(),
        ...sig,
        fecha: ctx.ahora,
        lineas: original.lineas.map((l) => ({ ...l, cantidad: -l.cantidad, importe: -l.importe })),
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
        huella: calcularHuella({
          nif: estado.ajustes.nif,
          numero: sig.numero,
          fecha: ctx.ahora,
          cuotaTotal: desglose.reduce((s, d) => s + d.cuota, 0),
          importeTotal: total,
          huellaAnterior: sig.huellaAnterior,
          generadoEn: ctx.ahora,
        }),
      };
      estado.tickets.push(ticket);
      imprimirTicket(estado, ctx, trabajos, ticket, false);
      break;
    }
    case "atender_aviso": {
      buscar(estado.avisos, accion.avisoId, "ese aviso").atendido = true;
      break;
    }
    case "cambiar_disponible": {
      buscar(estado.productos, accion.productoId, "ese producto").disponible = accion.disponible;
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
        estado.gastos.push({ id: ctx.nuevoId(), ...datos, empleadoId: empleado.id });
        const turno = turnoAbierto(estado);
        if (datos.deCaja && turno) {
          turno.movimientos.push({
            id: ctx.nuevoId(),
            fecha: ctx.ahora,
            tipo: "salida",
            importe: datos.importe,
            motivo: `Gasto: ${datos.concepto}`,
            empleadoId: empleado.id,
          });
        }
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
      const { id, ...datos } = accion.producto;
      buscar(estado.categorias, datos.categoriaId, "esa categoría");
      if (id) Object.assign(buscar(estado.productos, id, "ese producto"), datos);
      else estado.productos.push({ id: ctx.nuevoId(), ...datos });
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
    case "guardar_ajustes":
      estado.ajustes = accion.ajustes;
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

/** Aplica una acción que llega desde el QR de una mesa. */
export function reducirCliente(
  anterior: Estado,
  mesaToken: string,
  accion: AccionCliente,
  ctx: Contexto,
): Resultado {
  const estado = copiaEditable(anterior);
  const trabajos: TrabajoImpresion[] = [];
  const mesa =
    estado.mesas.find((m) => m.token === mesaToken) ??
    falla("Este QR ya no es válido. Pide uno nuevo al camarero.");

  switch (accion.tipo) {
    case "pedir": {
      if (!estado.ajustes.pedidosQRActivos)
        falla("Ahora mismo los pedidos se hacen con el camarero.");
      let cuenta = cuentaDeMesa(estado, mesa.id);
      if (!cuenta) {
        cuenta = {
          id: ctx.nuevoId(),
          mesaId: mesa.id,
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
        true,
      );
      cuenta.lineas.push(...lineas);
      if (confirmar) {
        const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
        avisar(
          estado,
          ctx,
          mesa.id,
          "pedido_qr",
          `${unidades} ${unidades === 1 ? "cosa" : "cosas"} por aceptar`,
        );
      } else {
        mandarRonda(estado, ctx, trabajos, cuenta, lineas, null);
      }
      break;
    }
    case "llamar_camarero":
      avisar(estado, ctx, mesa.id, "llamar", "Quieren que vayas a la mesa");
      break;
    case "pedir_cuenta": {
      const cuenta =
        cuentaDeMesa(estado, mesa.id) ?? falla("Todavía no hay nada que cobrar en esta mesa.");
      const como = { efectivo: "en efectivo", tarjeta: "con tarjeta", bizum: "con Bizum" }[
        accion.metodo
      ];
      avisar(estado, ctx, mesa.id, "cuenta", `Pagará ${como} · ${euros(totalCuenta(cuenta))}`);
      break;
    }
  }
  return { estado, trabajos };
}

/** Gasta un código de vinculación. Devuelve el estado sin ese código, o falla si no vale. */
export function usarCodigoVinculo(anterior: Estado, codigo: string, ahora: string): Estado {
  const vinculos = anterior.vinculos ?? [];
  if (!vinculos.some((v) => v.codigo === codigo && v.caduca > ahora))
    falla("Ese código no vale o ha caducado. Pide uno nuevo al encargado.");
  return { ...anterior, vinculos: vinculos.filter((v) => v.codigo !== codigo && v.caduca > ahora) };
}
