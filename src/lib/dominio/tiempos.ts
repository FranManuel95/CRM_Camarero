import { diaLocal } from "../fechas";
import { sumarDias } from "./informes";
import type { Destino, Estado, LineaCuenta, TiempoCocina } from "./tipos";

/** Días que se guardan los tiempos de cocina. */
const DIAS = 120;

/**
 * Apunta lo que ha tardado cada plato desde que se mandó hasta que cocina o barra lo marca listo.
 * Se guarda resumido por día y producto, para no llenar el estado.
 */
export function apuntarTiempos(estado: Estado, lineas: LineaCuenta[], ahora: string) {
  const dia = diaLocal(ahora);
  const tiempos = (estado.tiemposCocina ??= []);
  for (const l of lineas) {
    if (!l.enviadaEn) continue;
    const minutos = Math.max(0, (Date.parse(ahora) - Date.parse(l.enviadaEn)) / 60_000);
    // Más de 3 horas es que se olvidaron de marcarlo: no cuenta.
    if (minutos > 180) continue;
    let fila = tiempos.find(
      (t) => t.dia === dia && t.producto === l.nombre && t.destino === l.destino,
    );
    if (!fila) {
      fila = { dia, producto: l.nombre, destino: l.destino, veces: 0, minutos: 0, maximo: 0 };
      tiempos.push(fila);
    }
    fila.veces += l.cantidad;
    fila.minutos += minutos * l.cantidad;
    fila.maximo = Math.max(fila.maximo, minutos);
  }
  const desde = sumarDias(dia, -DIAS);
  estado.tiemposCocina = tiempos.filter((t) => t.dia >= desde);
}

export type FilaTiempo = {
  producto: string;
  destino: Destino;
  veces: number;
  media: number;
  maximo: number;
};

/** Tiempos de un periodo («2026-10-01» a «2026-10-31»), los más lentos primero. */
export function informeTiempos(
  tiempos: TiempoCocina[] | undefined,
  desde: string,
  hasta: string,
): { media: number; veces: number; filas: FilaTiempo[] } {
  const enRango = (tiempos ?? []).filter((t) => t.dia >= desde && t.dia <= hasta);
  const porProducto = new Map<string, FilaTiempo & { suma: number }>();
  for (const t of enRango) {
    const clave = `${t.destino}|${t.producto}`;
    const f = porProducto.get(clave) ?? {
      producto: t.producto,
      destino: t.destino,
      veces: 0,
      media: 0,
      maximo: 0,
      suma: 0,
    };
    f.veces += t.veces;
    f.suma += t.minutos;
    f.maximo = Math.max(f.maximo, t.maximo);
    porProducto.set(clave, f);
  }
  const filas = [...porProducto.values()]
    .map(({ suma, ...f }) => ({ ...f, media: f.veces ? suma / f.veces : 0 }))
    .sort((a, b) => b.media - a.media);
  const veces = filas.reduce((s, f) => s + f.veces, 0);
  const media = veces ? filas.reduce((s, f) => s + f.media * f.veces, 0) / veces : 0;
  return { media, veces, filas };
}
