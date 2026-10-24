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

/** Un «ticket» de la pantalla de cocina: una ronda de una mesa para un destino. */
export type PedidoCocina = {
  clave: string;
  cuenta: Cuenta;
  mesa: Mesa | undefined;
  ronda: number;
  enviadaEn: string;
  lineas: LineaCuenta[];
};

export function pedidosCocina(
  estado: Pick<Estado, "cuentas" | "mesas">,
  destino: Destino | "todo",
): PedidoCocina[] {
  const pedidos = new Map<string, PedidoCocina>();
  for (const cuenta of estado.cuentas) {
    if (cuenta.estado !== "abierta") continue;
    for (const l of cuenta.lineas) {
      if (l.estado !== "enviada" && l.estado !== "lista") continue;
      if (destino !== "todo" && l.destino !== destino) continue;
      const clave = `${cuenta.id}-${l.ronda}-${destino === "todo" ? l.destino : destino}`;
      const pedido = pedidos.get(clave) ?? {
        clave,
        cuenta,
        mesa: estado.mesas.find((m) => m.id === cuenta.mesaId),
        ronda: l.ronda,
        enviadaEn: l.enviadaEn ?? l.creadaEn,
        lineas: [],
      };
      pedido.lineas.push(l);
      pedidos.set(clave, pedido);
    }
  }
  // Los pedidos con todo listo van al final: ya solo esperan a que los recojan.
  return [...pedidos.values()].sort((a, b) => {
    const aListo = a.lineas.every((l) => l.estado === "lista");
    const bListo = b.lineas.every((l) => l.estado === "lista");
    if (aListo !== bListo) return aListo ? 1 : -1;
    return a.enviadaEn.localeCompare(b.enviadaEn);
  });
}
