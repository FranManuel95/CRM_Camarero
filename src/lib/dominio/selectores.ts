import { totalCuenta } from "./importes";
import type { Aviso, Cuenta, Destino, Estado, LineaCuenta, Mesa } from "./tipos";

export type SituacionMesa = "libre" | "ocupada" | "qr" | "cuenta" | "aviso";

export const TEXTO_SITUACION: Record<SituacionMesa, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  qr: "Pedido del QR",
  cuenta: "Pide la cuenta",
  aviso: "Te llaman",
};

type Datos = Pick<Estado, "cuentas" | "avisos">;

export function situacionMesa(estado: Datos, mesa: Mesa) {
  const cuenta = estado.cuentas.find((c) => c.mesaId === mesa.id && c.estado === "abierta");
  const avisos = estado.avisos.filter((a) => a.mesaId === mesa.id && !a.atendido);
  const tiene = (t: Aviso["tipo"]) => avisos.some((a) => a.tipo === t);
  // Lo más urgente manda: que te llamen, luego un pedido por aceptar, luego la cuenta.
  const situacion: SituacionMesa = tiene("llamar")
    ? "aviso"
    : tiene("pedido_qr")
      ? "qr"
      : tiene("cuenta")
        ? "cuenta"
        : cuenta
          ? "ocupada"
          : "libre";
  return {
    cuenta,
    avisos,
    situacion,
    total: cuenta ? totalCuenta(cuenta) : 0,
    listos: avisos.filter((a) => a.tipo === "listo").length,
  };
}

/** Mesa ficticia de las ventas rápidas (barra, para llevar). */
export const MESA_VENTA_RAPIDA = "venta-rapida";

/**
 * Lo que le toca a un sitio (cocina o barra) de unas líneas: las suyas, sin las opciones que van a
 * otro sitio, y las opciones suyas de platos de otro sitio (la bebida de un menú del día), que se
 * marcan como `ajena` (las ve, pero el plato lo lleva el otro sitio).
 */
export function lineasPara(destino: Destino, lineas: LineaCuenta[]): LineaCocina[] {
  return lineas.flatMap((l) => {
    if (l.destino === destino)
      return [{ ...l, opciones: l.opciones.filter((o) => !o.destino || o.destino === destino) }];
    const suyas = l.opciones.filter((o) => o.destino === destino);
    return suyas.length ? [{ ...l, opciones: suyas, ajena: true }] : [];
  });
}

export type LineaCocina = LineaCuenta & { ajena?: boolean };

/** Un «ticket» de la pantalla de cocina: una ronda de una mesa para un destino. */
export type PedidoCocina = {
  clave: string;
  cuenta: Cuenta;
  nombre: string;
  ronda: number;
  enviadaEn: string;
  lineas: LineaCocina[];
};

const EN_COCINA = new Set(["enviada", "lista", "en_espera"]);

/**
 * Las cuentas que necesitan las pantallas: las abiertas y las ya cobradas que aún tienen algo en
 * cocina o barra (una venta rápida se cobra al pedir), de las últimas 12 horas.
 */
export function cuentaEnJuego(cuenta: Cuenta, ahora = Date.now()): boolean {
  if (cuenta.estado === "abierta") return true;
  if (cuenta.estado !== "cobrada" || !cuenta.cerradaEn) return false;
  return (
    Date.parse(cuenta.cerradaEn) > ahora - 12 * 3_600_000 &&
    cuenta.lineas.some((l) => EN_COCINA.has(l.estado))
  );
}

/**
 * Lo que hay en marcha en cocina o barra. También lo ya cobrado que aún no ha salido (las ventas
 * rápidas se cobran al pedir).
 */
export function pedidosCocina(
  estado: Pick<Estado, "cuentas" | "mesas">,
  destino: Destino | "todo",
): PedidoCocina[] {
  const pedidos = new Map<string, PedidoCocina>();
  const destinos: Destino[] = destino === "todo" ? ["cocina", "barra"] : [destino];
  for (const cuenta of estado.cuentas) {
    if (cuenta.estado === "anulada") continue;
    const vivas = cuenta.lineas.filter((l) => EN_COCINA.has(l.estado));
    if (!vivas.length) continue;
    const nombre =
      cuenta.mesaId === MESA_VENTA_RAPIDA
        ? "Venta rápida"
        : (estado.mesas.find((m) => m.id === cuenta.mesaId)?.nombre ?? "Mesa");
    for (const d of destinos) {
      for (const l of lineasPara(d, vivas)) {
        const clave = `${cuenta.id}-${l.ronda}-${d}`;
        const pedido = pedidos.get(clave) ?? {
          clave,
          cuenta,
          nombre,
          ronda: l.ronda,
          enviadaEn: l.enviadaEn ?? l.creadaEn,
          lineas: [],
        };
        pedido.lineas.push(l);
        pedidos.set(clave, pedido);
      }
    }
  }
  const terminado = (p: PedidoCocina) =>
    p.lineas.filter((l) => !l.ajena && l.estado !== "en_espera").every((l) => l.estado === "lista");
  // Lo que solo espera a que lo recojan va al final.
  return [...pedidos.values()]
    .filter((p) => p.lineas.some((l) => !l.ajena))
    .sort((a, b) => {
      if (terminado(a) !== terminado(b)) return terminado(a) ? 1 : -1;
      return a.enviadaEn.localeCompare(b.enviadaEn);
    });
}
