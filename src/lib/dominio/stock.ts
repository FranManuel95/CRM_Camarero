import type {
  Centimos,
  Estado,
  Ingrediente,
  LineaCuenta,
  LineaReceta,
  Producto,
  Unidad,
} from "./tipos";
import { activa } from "./funciones";

/**
 * Stock del almacén. Cada plato con escandallo descuenta lo que lleva al mandarlo a cocina o
 * barra (no al cobrar: lo que se prepara se gasta aunque luego se invite). Si se anula una línea
 * ya mandada, se devuelve. Cuando un ingrediente no llega para una ración más, los platos que lo
 * llevan se ponen agotados solos, y vuelven en cuanto entra género.
 */

/** Las cantidades van con decimales (0,2 l de cerveza): se redondean a milésimas. */
export function redondear(cantidad: number): number {
  return Math.round(cantidad * 1000) / 1000;
}

/** «1,5 kg», «0,2 l», «12 ud». */
export function formatearCantidad(cantidad: number, unidad: Unidad): string {
  const texto = redondear(cantidad).toLocaleString("es-ES", { maximumFractionDigits: 3 });
  return `${texto} ${unidad}`;
}

/** Lee «1,5» o «1.5». Devuelve null si no es un número. */
export function leerCantidad(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return redondear(Number(limpio));
}

/** Lo que cuesta una ración según su escandallo. */
export function costeReceta(receta: LineaReceta[], ingredientes: Ingrediente[]): Centimos {
  return Math.round(
    receta.reduce((s, r) => {
      const ing = ingredientes.find((i) => i.id === r.ingredienteId);
      return s + (ing ? ing.coste * r.cantidad : 0);
    }, 0),
  );
}

/** El coste de una ración: el del escandallo si lo tiene, si no el que se puso a mano. */
export function costeProducto(
  producto: Pick<Producto, "receta" | "coste">,
  ingredientes: Ingrediente[],
): Centimos | undefined {
  if (producto.receta?.length) return costeReceta(producto.receta, ingredientes);
  return producto.coste;
}

/** Lo que gastan unas líneas, sumado por ingrediente. */
function consumo(estado: Estado, lineas: LineaCuenta[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const l of lineas) {
    const producto = estado.productos.find((p) => p.id === l.productoId);
    for (const r of producto?.receta ?? [])
      total.set(r.ingredienteId, (total.get(r.ingredienteId) ?? 0) + r.cantidad * l.cantidad);
  }
  return total;
}

function sumar(estado: Estado, cantidades: Map<string, number>, signo: 1 | -1) {
  for (const [id, cantidad] of cantidades) {
    const ing = estado.ingredientes.find((i) => i.id === id);
    if (ing) ing.existencias = redondear(ing.existencias + signo * cantidad);
  }
}

/** Descuenta lo que llevan las líneas que se acaban de mandar. */
export function descontar(estado: Estado, lineas: LineaCuenta[]) {
  if (!activa(estado.ajustes, "stock")) return;
  const nuevas = lineas.filter((l) => !l.descontado);
  sumar(estado, consumo(estado, nuevas), -1);
  for (const l of nuevas) l.descontado = true;
  revisarAgotados(estado);
}

/** Devuelve al stock lo de unas líneas anuladas que ya se habían descontado. */
export function devolver(estado: Estado, lineas: LineaCuenta[]) {
  const descontadas = lineas.filter((l) => l.descontado);
  sumar(estado, consumo(estado, descontadas), 1);
  for (const l of descontadas) delete l.descontado;
  revisarAgotados(estado);
}

/** ¿Llega el stock para una ración más? */
export function hayParaUnaMas(
  producto: Pick<Producto, "receta">,
  ingredientes: Ingrediente[],
): boolean {
  return (producto.receta ?? []).every((r) => {
    const ing = ingredientes.find((i) => i.id === r.ingredienteId);
    return !ing || ing.existencias >= r.cantidad;
  });
}

/**
 * Agota los platos que ya no se pueden hacer y repone los que agotó el stock si vuelve a haber.
 * Lo que una persona puso agotado a mano no se toca.
 */
export function revisarAgotados(estado: Estado) {
  const conStock = activa(estado.ajustes, "stock");
  for (const p of estado.productos) {
    if (!conStock) {
      // Sin stock nada se agota solo: lo que agotó el stock vuelve a estar disponible.
      if (p.agotadoPorStock) {
        p.disponible = true;
        delete p.agotadoPorStock;
      }
      continue;
    }
    if (!p.receta?.length) {
      delete p.agotadoPorStock;
      continue;
    }
    const hay = hayParaUnaMas(p, estado.ingredientes);
    if (!hay && p.disponible) {
      p.disponible = false;
      p.agotadoPorStock = true;
    } else if (hay && p.agotadoPorStock) {
      p.disponible = true;
      delete p.agotadoPorStock;
    }
  }
}

export function bajoMinimo(ingrediente: Ingrediente): boolean {
  return ingrediente.existencias <= ingrediente.minimo;
}

export type LineaCompra = { ingrediente: Ingrediente; cantidad: number; importe: Centimos };
export type PedidoProveedor = { proveedor: string; lineas: LineaCompra[]; total: Centimos };

/** Cuánto pedir de un ingrediente para volver a tenerlo como se quiere. */
export function cantidadAPedir(ingrediente: Ingrediente): number {
  const objetivo = ingrediente.pedirHasta ?? ingrediente.minimo * 2;
  const falta = Math.max(0, objetivo - ingrediente.existencias);
  return ingrediente.unidad === "ud" ? Math.ceil(falta) : redondear(falta);
}

/** Lista de la compra: lo que está en el mínimo o por debajo, agrupado por proveedor. */
export function listaDeLaCompra(ingredientes: Ingrediente[]): PedidoProveedor[] {
  const porProveedor = new Map<string, LineaCompra[]>();
  for (const ing of ingredientes) {
    if (!bajoMinimo(ing)) continue;
    const cantidad = cantidadAPedir(ing);
    if (cantidad <= 0) continue;
    const clave = ing.proveedor.trim() || "Sin proveedor";
    const linea = { ingrediente: ing, cantidad, importe: Math.round(ing.coste * cantidad) };
    porProveedor.set(clave, [...(porProveedor.get(clave) ?? []), linea]);
  }
  return [...porProveedor]
    .map(([proveedor, lineas]) => ({
      proveedor,
      lineas: lineas.sort((a, b) => a.ingrediente.nombre.localeCompare(b.ingrediente.nombre)),
      total: lineas.reduce((s, l) => s + l.importe, 0),
    }))
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor));
}

/** El pedido en texto, para mandarlo por WhatsApp o correo. */
export function textoPedido(pedido: PedidoProveedor, nombreLocal: string): string {
  const lineas = pedido.lineas.map(
    (l) => `- ${l.ingrediente.nombre}: ${formatearCantidad(l.cantidad, l.ingrediente.unidad)}`,
  );
  return [`Hola, pedido de ${nombreLocal}:`, ...lineas, "Gracias."].join("\n");
}

/** Platos que usan un ingrediente. */
export function platosCon(estado: Pick<Estado, "productos">, ingredienteId: string): Producto[] {
  return estado.productos.filter((p) => p.receta?.some((r) => r.ingredienteId === ingredienteId));
}

/** Lo que se ha leído de la foto de una factura (importes en euros, como vienen en el papel). */
export type LecturaFactura = {
  proveedor: string;
  /** Tipo de IVA principal de la factura, en %. */
  iva: number;
  lineas: {
    /** El ingrediente del almacén al que corresponde, o null si no se parece a ninguno. */
    ingredienteId: string | null;
    descripcion: string;
    /** En la unidad del ingrediente (kg, litros o unidades). */
    cantidad: number;
    /** Importe de la línea con IVA, en euros. */
    importe: number;
  }[];
};

export type PedidoLeido = {
  proveedor: string;
  iva: number;
  lineas: { ingredienteId: string; cantidad: number; importe: Centimos }[];
  /** Lo que no se ha podido casar con ningún ingrediente (para revisarlo a mano). */
  sinCasar: string[];
};

const TIPOS_IVA = [0, 4, 10, 21];

/**
 * Pasa la lectura de una factura a líneas de pedido: solo se fía de los ingredientes que existen
 * y de cantidades e importes con sentido. Todo lo demás queda para revisarlo a mano.
 */
export function pedidoDeFactura(lectura: LecturaFactura, ingredientes: Ingrediente[]): PedidoLeido {
  const lineas: PedidoLeido["lineas"] = [];
  const sinCasar: string[] = [];
  for (const l of lectura.lineas) {
    const ing = ingredientes.find((i) => i.id === l.ingredienteId);
    const cantidad = redondear(l.cantidad);
    if (!ing || !(cantidad > 0)) {
      if (l.descripcion.trim()) sinCasar.push(l.descripcion.trim());
      continue;
    }
    const importe = Number.isFinite(l.importe) && l.importe > 0 ? Math.round(l.importe * 100) : 0;
    const previa = lineas.find((x) => x.ingredienteId === ing.id);
    if (previa) {
      previa.cantidad = redondear(previa.cantidad + cantidad);
      previa.importe += importe;
    } else lineas.push({ ingredienteId: ing.id, cantidad, importe });
  }
  const iva = TIPOS_IVA.includes(lectura.iva) ? lectura.iva : 10;
  return { proveedor: lectura.proveedor.trim().slice(0, 120), iva, lineas, sinCasar };
}
