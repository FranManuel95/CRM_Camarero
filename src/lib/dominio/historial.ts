import type { AccionPersonal } from "./acciones";
import { FUNCIONES } from "./funciones";
import { euros, totalCuenta } from "./importes";
import { buscarMesa } from "./selectores";
import type { Cuenta, Estado } from "./tipos";

/**
 * Historial de cambios: quién hizo qué y cuándo, en una frase. Solo lo que importa saber
 * después (anulaciones, descuentos, caja, carta, equipo…); lo del día a día (anotar, mandar,
 * marcar listo) no se apunta, que ya se ve en las cuentas y los tickets.
 */

const nombreMesa = (estado: Estado, mesaId: string) =>
  buscarMesa(estado, mesaId)?.nombre ?? "una mesa";

const cuenta = (estado: Estado, id: string): Cuenta | undefined =>
  estado.cuentas.find((c) => c.id === id);

const nombreDe = (lista: { id: string; nombre: string }[], id: string) =>
  lista.find((x) => x.id === id)?.nombre ?? "—";

/** Frase para el historial, o null si la acción no se apunta. */
export function describir(accion: AccionPersonal, antes: Estado, despues: Estado): string | null {
  switch (accion.tipo) {
    case "anular_linea": {
      const c = cuenta(antes, accion.cuentaId);
      const l = c?.lineas.find((x) => x.id === accion.lineaId);
      if (!c || !l) return null;
      return `Anuló ${l.cantidad} ${l.nombre} en ${nombreMesa(antes, c.mesaId)} («${accion.motivo}»)`;
    }
    case "anular_cuenta": {
      const c = cuenta(antes, accion.cuentaId);
      if (!c) return null;
      return `Anuló la cuenta de ${nombreMesa(antes, c.mesaId)} (${euros(totalCuenta(c))})`;
    }
    case "invitar_linea": {
      const c = cuenta(antes, accion.cuentaId);
      const l = c?.lineas.find((x) => x.id === accion.lineaId);
      if (!c || !l) return null;
      const donde = nombreMesa(antes, c.mesaId);
      return accion.invitacion
        ? `Invitó a ${l.cantidad} ${l.nombre} en ${donde}`
        : `Quitó la invitación de ${l.nombre} en ${donde}`;
    }
    case "aplicar_descuento": {
      const c = cuenta(antes, accion.cuentaId);
      if (!c) return null;
      const donde = nombreMesa(antes, c.mesaId);
      const partes = [
        accion.descuento ? `un ${accion.descuento} %` : "",
        accion.importe ? euros(accion.importe) : "",
      ].filter(Boolean);
      return partes.length
        ? `Puso ${partes.join(" y ")} de descuento en ${donde}`
        : `Quitó el descuento de ${donde}`;
    }
    case "ajustar_lineas": {
      const c = cuenta(antes, accion.cuentaId);
      if (!c) return null;
      const lineas = c.lineas.filter((l) => accion.lineaIds.includes(l.id));
      const que = lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(", ");
      const donde = nombreMesa(antes, c.mesaId);
      const cambio = accion.cambio;
      if (cambio.tipo === "precio")
        return `Cambió el precio de ${que} a ${euros(cambio.precio)}/ud. en ${donde}`;
      if (cambio.tipo === "descuento")
        return cambio.porcentaje
          ? `Puso un ${cambio.porcentaje} % de descuento a ${que} en ${donde}`
          : `Quitó el descuento de ${que} en ${donde}`;
      return `Volvió al precio de la carta ${que} en ${donde}`;
    }
    case "mover_cuenta": {
      const c = cuenta(antes, accion.cuentaId);
      if (!c) return null;
      return `Pasó la cuenta de ${nombreMesa(antes, c.mesaId)} a ${nombreMesa(antes, accion.mesaId)}`;
    }
    case "rechazar_pedido_qr": {
      const c = cuenta(antes, accion.cuentaId);
      return c ? `Rechazó un pedido del QR en ${nombreMesa(antes, c.mesaId)}` : null;
    }
    case "rectificar_ticket": {
      const t = antes.tickets.find((x) => x.id === accion.ticketId);
      return t ? `Rectificó el ticket ${t.numero} (${euros(t.total)})` : null;
    }
    case "reimprimir_ticket": {
      const t = antes.tickets.find((x) => x.id === accion.ticketId);
      return t ? `Reimprimió el ticket ${t.numero}` : null;
    }
    case "abrir_caja":
      return `Abrió la caja con ${euros(accion.fondoInicial)} de fondo`;
    case "cerrar_caja":
      return `Cerró la caja contando ${euros(accion.efectivoContado)} en efectivo`;
    case "movimiento_caja":
      return `${accion.movimiento === "entrada" ? "Metió" : "Sacó"} ${euros(accion.importe)} de la caja («${accion.motivo}»)`;
    case "cambiar_disponible": {
      const p = nombreDe(antes.productos, accion.productoId);
      if (accion.oculto) return `Ocultó ${p} de la carta`;
      return `Puso ${p} como ${accion.disponible ? "disponible" : "agotado"}`;
    }
    case "ajustar_stock": {
      const i = antes.ingredientes.find((x) => x.id === accion.ingredienteId);
      if (!i) return null;
      return accion.ajuste === "recuento"
        ? `Contó ${i.nombre}: hay ${accion.cantidad} ${i.unidad} (antes ${i.existencias})`
        : `Apuntó una merma de ${accion.cantidad} ${i.unidad} de ${i.nombre}`;
    }
    case "guardar_gasto": {
      const g = accion.gasto;
      return g.id
        ? `Cambió el gasto «${g.concepto}» (${euros(g.importe)})`
        : `Apuntó el gasto «${g.concepto}» (${euros(g.importe)})`;
    }
    case "borrar_gasto": {
      const g = antes.gastos.find((x) => x.id === accion.gastoId);
      return g ? `Borró el gasto «${g.concepto}» (${euros(g.importe)})` : null;
    }
    case "guardar_categoria":
      return accion.categoria.id
        ? `Cambió la categoría ${accion.categoria.nombre}`
        : `Creó la categoría ${accion.categoria.nombre}`;
    case "borrar_categoria":
      return `Borró la categoría ${nombreDe(antes.categorias, accion.categoriaId)}`;
    case "guardar_producto": {
      const nuevo = accion.producto;
      const previo = nuevo.id ? antes.productos.find((p) => p.id === nuevo.id) : undefined;
      if (!previo) return `Añadió ${nuevo.nombre} a la carta (${euros(nuevo.precio)})`;
      return previo.precio !== nuevo.precio
        ? `Cambió el precio de ${nuevo.nombre} de ${euros(previo.precio)} a ${euros(nuevo.precio)}`
        : `Cambió ${nuevo.nombre} en la carta`;
    }
    case "borrar_producto":
      return `Quitó ${nombreDe(antes.productos, accion.productoId)} de la carta`;
    case "guardar_zona":
      return accion.zona.id
        ? `Cambió la zona ${accion.zona.nombre}`
        : `Creó la zona ${accion.zona.nombre}`;
    case "borrar_zona":
      return `Borró la zona ${nombreDe(antes.zonas, accion.zonaId)}`;
    case "guardar_mesa":
      return accion.mesa.id ? null : `Añadió la mesa ${accion.mesa.nombre}`;
    case "borrar_mesa":
      return `Borró la mesa ${nombreDe(antes.mesas, accion.mesaId)}`;
    case "regenerar_qr":
      return `Cambió el QR de ${nombreDe(antes.mesas, accion.mesaId)} (el viejo ya no vale)`;
    case "guardar_empleado": {
      const e = accion.empleado;
      if (!e.id) return `Dio de alta a ${e.nombre} como ${e.rol}`;
      const previo = antes.empleados.find((x) => x.id === e.id);
      if (previo?.activo && !e.activo) return `Desactivó a ${e.nombre}`;
      if (previo && !previo.activo && e.activo) return `Volvió a activar a ${e.nombre}`;
      if (previo && previo.rol !== e.rol) return `Hizo ${e.rol} a ${e.nombre}`;
      return e.pin ? `Cambió el PIN de ${e.nombre}` : `Cambió los datos de ${e.nombre}`;
    }
    case "guardar_ajustes":
      return "Cambió los datos del local o del ticket";
    case "guardar_impresora":
      return accion.impresora.id
        ? `Cambió la impresora ${accion.impresora.nombre}`
        : `Añadió la impresora ${accion.impresora.nombre}`;
    case "borrar_impresora":
      return `Quitó la impresora ${nombreDe(antes.impresoras, accion.impresoraId)}`;
    case "crear_codigo_vinculo":
      return "Creó un código para vincular un aparato";
    case "cambiar_funcion":
      return `${accion.activa ? "Encendió" : "Apagó"} «${FUNCIONES[accion.funcion].nombre}»`;
    case "corregir_fichaje":
      return `${accion.fichajeId ? "Corrigió" : "Apuntó a mano"} un fichaje de ${nombreDe(antes.empleados, accion.empleadoId)} («${accion.motivo}»)`;
    case "guardar_ingrediente":
      return accion.ingrediente.id
        ? `Cambió el ingrediente ${accion.ingrediente.nombre}`
        : `Dio de alta el ingrediente ${accion.ingrediente.nombre}`;
    case "borrar_ingrediente":
      return `Borró el ingrediente ${nombreDe(antes.ingredientes, accion.ingredienteId)}`;
    case "recibir_compra": {
      const gasto = despues.gastos.length > antes.gastos.length ? despues.gastos.at(-1) : null;
      const quien = accion.proveedor || "un proveedor";
      return `Recibió un pedido de ${quien}${gasto ? ` (${euros(gasto.importe)})` : ""}`;
    }
    case "guardar_reserva": {
      const r = accion.reserva;
      const cuando = `el ${r.dia.slice(8)}/${r.dia.slice(5, 7)} a las ${r.hora}`;
      return r.id
        ? `Cambió la reserva de ${r.nombre} (${cuando})`
        : `Apuntó una reserva de ${r.nombre} para ${r.personas} (${cuando})`;
    }
    case "cambiar_reserva": {
      const r = antes.reservas.find((x) => x.id === accion.reservaId);
      if (!r) return null;
      const que = {
        por_confirmar: "dejó por confirmar",
        confirmada: "confirmó",
        cancelada: "canceló",
        no_vino: "marcó que no vino",
      }[accion.estado];
      return `${que.charAt(0).toUpperCase()}${que.slice(1)} la reserva de ${r.nombre}`;
    }
    case "guardar_cliente":
      return accion.cliente.id
        ? `Cambió los datos de ${accion.cliente.nombre} en el club`
        : `Apuntó a ${accion.cliente.nombre} en el club`;
    case "canjear_puntos": {
      const c = cuenta(antes, accion.cuentaId);
      if (!c) return null;
      const cliente = antes.clientes.find((x) => x.id === c.clienteId);
      return accion.canjear
        ? `Canjeó el premio del club de ${cliente?.nombre ?? "un cliente"} en ${nombreMesa(antes, c.mesaId)}`
        : `Quitó el premio del club en ${nombreMesa(antes, c.mesaId)}`;
    }
    case "saldar_deuda": {
      const c = antes.clientes.find((x) => x.id === accion.clienteId);
      return `Cobró ${euros(accion.importe)} de lo que debía ${c?.nombre ?? "un cliente"}`;
    }
    case "baja_cliente":
      return "Dio de baja a un cliente del club y borró sus datos";
    case "guardar_tarifas":
      return `Cambió los precios por horario y zona (${accion.tarifas.filter((t) => t.activa).length} activos)`;
    case "reglas_club":
      return `Cambió los puntos del club: ${accion.reglas.puntosPremio} puntos = ${euros(accion.reglas.valorPremio)}`;
    case "copiar_semana":
      return "Copió los turnos de una semana a otra";
    default:
      return null;
  }
}
