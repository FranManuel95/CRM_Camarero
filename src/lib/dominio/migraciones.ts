import { resumenPin } from "./pin";
import type { Estado } from "./tipos";

export const VERSION_ESTADO = 7;

/** Pone al día un estado guardado con una versión anterior del programa. */
export function migrar(estado: Estado): Estado {
  let e = estado;
  if (e.version === 1) {
    // Versión 2: los PIN se guardan resumidos.
    e = { ...e, version: 2, empleados: e.empleados.map((x) => ({ ...x, pin: resumenPin(x.pin) })) };
  }
  if (e.version === 2) {
    // Versión 3: stock (ingredientes y movimientos del almacén).
    e = { ...e, version: 3, ingredientes: [], movimientosStock: [] };
  }
  if (e.version === 3) {
    // Versión 4: equipo (fichajes, cuadrante de turnos y anulaciones e invitaciones).
    e = { ...e, version: 4, fichajes: [], cuadrante: [], incidencias: [] };
  }
  if (e.version === 4) {
    // Versión 5: historial de cambios.
    e = { ...e, version: 5, historial: [] };
  }
  if (e.version === 5) {
    // Versión 6: reservas y pagos desde el QR.
    e = { ...e, version: 6, reservas: [], pagosOnline: [] } as Estado;
  }
  if (e.version === 6) {
    // Versión 7: club de clientes (y fuera los pagos desde el móvil, que no se usan).
    const { pagosOnline: _p, ...resto } = e as Estado & { pagosOnline?: unknown };
    void _p;
    e = { ...resto, version: 7, clientes: [] };
  }
  if (e.version !== VERSION_ESTADO)
    throw new Error(`Datos de una versión desconocida (${e.version}).`);
  return e;
}
