import { DIAS_EN_PANTALLA } from "../constantes";
import { servicios } from "./servicios";
import { activa } from "../dominio/funciones";
import { cuentaDeMesa } from "../dominio/reducir";
import { cuentaEnJuego } from "../dominio/selectores";
import { pagadoCuenta, totalCuenta } from "../dominio/importes";
import { dentroDeHorario } from "../dominio/horario";
import type { Empleado, Estado, LineaCuenta } from "../dominio/tipos";

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

/** Lo que ve un cliente desde el QR: la carta y su mesa. Nada de otras mesas ni del local. */
export function vistaCliente(estado: Estado, token: string, ahora = new Date().toISOString()) {
  const mesa = estado.mesas.find((m) => m.token === token);
  if (!mesa) return null;
  const categorias = estado.categorias
    .filter((c) => c.visibleEnQR && dentroDeHorario(c.horario, ahora))
    .sort((a, b) => a.orden - b.orden);
  const ids = new Set(categorias.map((c) => c.id));
  const cuenta = cuentaDeMesa(estado, mesa.id);
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
      ingles: activa(estado.ajustes, "cartaIngles"),
    },
    mesa: { nombre: mesa.nombre },
    categorias: categorias.map(({ id, nombre, nombreEn }) => ({ id, nombre, nombreEn })),
    productos: estado.productos
      .filter((p) => ids.has(p.categoriaId))
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
    cuenta: cuenta ? { lineas, total: totalCuenta(cuenta), pagado: pagadoCuenta(cuenta) } : null,
    avisos,
  };
}
export type VistaCliente = NonNullable<ReturnType<typeof vistaCliente>>;
