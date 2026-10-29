import { totalCuenta } from "./importes";
import type { Aviso, Cuenta, DatosLlevar, Destino, Estado, LineaCuenta, Mesa } from "./tipos";

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

/** Mesa ficticia de las ventas rápidas (barra). */
export const MESA_VENTA_RAPIDA = "venta-rapida";

/** Los pedidos para llevar no tienen mesa: su `mesaId` es este prefijo y un código propio. */
export const PREFIJO_LLEVAR = "llevar-";
export const esParaLlevar = (mesaId: string) => mesaId.startsWith(PREFIJO_LLEVAR);

/** «Para llevar · Lucía, 14:30». */
export const nombreLlevar = (llevar: Pick<DatosLlevar, "nombre" | "recogida">) =>
  `Para llevar · ${llevar.nombre}, ${llevar.recogida}`;

/**
 * La mesa de un `mesaId`, también las que no existen de verdad (venta rápida y pedidos para
 * llevar), para enseñar su nombre en la cuenta, la cocina o el ticket.
 */
export function buscarMesa(
  estado: Pick<Estado, "mesas" | "cuentas">,
  mesaId: string,
): Mesa | undefined {
  const virtual = (nombre: string): Mesa => ({
    id: mesaId,
    nombre,
    zonaId: "",
    x: 0,
    y: 0,
    ancho: 0,
    alto: 0,
    forma: "cuadrada",
    plazas: 1,
    token: "",
  });
  if (mesaId === MESA_VENTA_RAPIDA) return virtual("Venta rápida");
  if (esParaLlevar(mesaId)) {
    const llevar = estado.cuentas.find((c) => c.mesaId === mesaId)?.llevar;
    return llevar ? virtual(nombreLlevar(llevar)) : undefined;
  }
  return estado.mesas.find((m) => m.id === mesaId);
}

/** Nombre para la pantalla de pedidos: el nombre y la inicial del apellido («Lucía M.»). */
export function nombreCorto(nombre: string): string {
  const [primero = "", segundo] = nombre.trim().split(/\s+/);
  return segundo ? `${primero} ${segundo[0]!.toUpperCase()}.` : primero;
}

/**
 * Lo que sale en la pantalla que ven los clientes: quién está esperando y quién ya puede
 * recoger. Solo los pedidos que ya están en cocina o barra.
 */
export function pantallaPedidos(estado: Pick<Estado, "cuentas">): {
  preparando: { id: string; nombre: string }[];
  listos: { id: string; nombre: string }[];
} {
  const preparando: { id: string; nombre: string }[] = [];
  const listos: { id: string; nombre: string }[] = [];
  for (const c of pedidosParaLlevar(estado)) {
    const enCocina = c.lineas.filter((l) => EN_COCINA.has(l.estado));
    if (!enCocina.length || c.lineas.some((l) => l.estado === "por_confirmar")) continue;
    const fila = { id: c.id, nombre: nombreCorto(c.llevar!.nombre) };
    if (enCocina.every((l) => l.estado === "lista")) listos.push(fila);
    else preparando.push(fila);
  }
  return { preparando, listos };
}

/**
 * Los pedidos para llevar que faltan por entregar, por hora de recogida: los abiertos y los ya
 * pagados desde el móvil que aún no se han recogido. Los online sin nada pedido no cuentan.
 */
export function pedidosParaLlevar(estado: Pick<Estado, "cuentas">): Cuenta[] {
  return estado.cuentas
    .filter((c) => {
      if (!c.llevar) return false;
      if (c.estado === "abierta") return c.lineas.length > 0 || !c.llevar.online;
      return c.estado === "cobrada" && c.lineas.some((l) => EN_COCINA.has(l.estado));
    })
    .sort((a, b) => a.llevar!.recogida.localeCompare(b.llevar!.recogida));
}

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
    const nombre = cuenta.llevar
      ? nombreLlevar(cuenta.llevar)
      : (buscarMesa(estado, cuenta.mesaId)?.nombre ?? "Mesa");
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
