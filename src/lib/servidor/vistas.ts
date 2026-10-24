import { DIAS_EN_PANTALLA } from "../constantes";
import { cuentaDeMesa } from "../dominio/reducir";
import { totalCuenta } from "../dominio/importes";
import type { Estado, LineaCuenta } from "../dominio/tipos";

/**
 * Lo que ve el personal: todo menos los PIN y el historial antiguo. Las cuentas cerradas no
 * hacen falta en las pantallas: lo cobrado está en los tickets.
 */
export function vistaPersonal(estado: Estado, ahora = Date.now()) {
  const desde = new Date(ahora - DIAS_EN_PANTALLA * 86_400_000).toISOString();
  return {
    ...estado,
    empleados: estado.empleados.map((e) => ({ ...e, pin: "" })),
    cuentas: estado.cuentas.filter((c) => c.estado === "abierta"),
    tickets: estado.tickets.filter((t) => t.fecha >= desde),
    turnos: estado.turnos.filter((t) => !t.cerradoEn || t.cerradoEn >= desde),
  };
}
export type VistaPersonal = ReturnType<typeof vistaPersonal>;

export type LineaCliente = Pick<
  LineaCuenta,
  "id" | "nombre" | "cantidad" | "precioUnitario" | "opciones" | "nota" | "estado" | "invitacion"
>;

/** Lo que ve un cliente desde el QR: la carta y su mesa. Nada de otras mesas ni del local. */
export function vistaCliente(estado: Estado, token: string) {
  const mesa = estado.mesas.find((m) => m.token === token);
  if (!mesa) return null;
  const categorias = estado.categorias
    .filter((c) => c.visibleEnQR)
    .sort((a, b) => a.orden - b.orden);
  const ids = new Set(categorias.map((c) => c.id));
  const cuenta = cuentaDeMesa(estado, mesa.id);
  const lineas: LineaCliente[] = (cuenta?.lineas ?? [])
    .filter((l) => l.estado !== "anulada")
    .map(({ id, nombre, cantidad, precioUnitario, opciones, nota, estado: e, invitacion }) => ({
      id,
      nombre,
      cantidad,
      precioUnitario,
      opciones,
      nota,
      estado: e,
      invitacion,
    }));
  const avisos = estado.avisos
    .filter((a) => a.mesaId === mesa.id && !a.atendido)
    .map((a) => a.tipo);
  return {
    local: {
      nombre: estado.ajustes.nombreLocal,
      pedidosActivos: estado.ajustes.pedidosQRActivos,
      confirmarPedidos: estado.ajustes.confirmarPedidosQR,
    },
    mesa: { nombre: mesa.nombre },
    categorias: categorias.map(({ id, nombre }) => ({ id, nombre })),
    productos: estado.productos
      .filter((p) => ids.has(p.categoriaId))
      .sort((a, b) => a.orden - b.orden)
      .map(({ id, categoriaId, nombre, descripcion, precio, alergenos, disponible, grupos }) => ({
        id,
        categoriaId,
        nombre,
        descripcion,
        precio,
        alergenos,
        disponible,
        grupos,
      })),
    cuenta: cuenta ? { lineas, total: totalCuenta(cuenta) } : null,
    avisos,
  };
}
export type VistaCliente = NonNullable<ReturnType<typeof vistaCliente>>;
