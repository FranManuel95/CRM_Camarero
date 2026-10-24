import type { Centimos, Cuenta, DesgloseIva, LineaCuenta, LineaTicket, Pago } from "./tipos";

const formato = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

/** 1234 → «12,34 €». */
export function euros(centimos: Centimos): string {
  return formato.format(centimos / 100);
}

/** «12,5» o «12.50» → 1250. Devuelve null si no es un importe válido. */
export function leerEuros(texto: string): Centimos | null {
  const limpio = texto.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

export function precioConOpciones(linea: Pick<LineaCuenta, "precioUnitario" | "opciones">) {
  return linea.precioUnitario + linea.opciones.reduce((s, o) => s + o.suplemento, 0);
}

/** Las líneas que cuentan para cobrar: ni anuladas ni pendientes de aceptar. */
export function lineasCobrables(cuenta: Pick<Cuenta, "lineas">): LineaCuenta[] {
  return cuenta.lineas.filter((l) => l.estado !== "anulada" && l.estado !== "por_confirmar");
}

export function importeLinea(linea: LineaCuenta): Centimos {
  if (linea.invitacion) return 0;
  return precioConOpciones(linea) * linea.cantidad;
}

export function subtotalCuenta(cuenta: Pick<Cuenta, "lineas">): Centimos {
  return lineasCobrables(cuenta).reduce((s, l) => s + importeLinea(l), 0);
}

export function aplicarDescuento(importe: Centimos, descuento: number): Centimos {
  return Math.round((importe * (100 - descuento)) / 100);
}

export function totalCuenta(cuenta: Pick<Cuenta, "lineas" | "descuento">): Centimos {
  return aplicarDescuento(subtotalCuenta(cuenta), cuenta.descuento);
}

/** Agrupa líneas iguales (mismo producto, opciones y precio) para el ticket. */
export function lineasDeTicket(cuenta: Pick<Cuenta, "lineas">): LineaTicket[] {
  const grupos = new Map<string, LineaTicket>();
  for (const l of lineasCobrables(cuenta)) {
    const unitario = l.invitacion ? 0 : precioConOpciones(l);
    const nombre =
      l.nombre +
      (l.opciones.length ? ` (${l.opciones.map((o) => o.nombre).join(", ")})` : "") +
      (l.invitacion ? " · invitación" : "");
    const clave = `${nombre}|${unitario}|${l.iva}`;
    const previa = grupos.get(clave);
    if (previa) {
      previa.cantidad += l.cantidad;
      previa.importe += unitario * l.cantidad;
    } else {
      grupos.set(clave, {
        nombre,
        producto: l.nombre,
        cantidad: l.cantidad,
        precioUnitario: unitario,
        importe: unitario * l.cantidad,
        iva: l.iva,
      });
    }
  }
  return [...grupos.values()];
}

/**
 * Desglose de IVA de un ticket. Los precios llevan el IVA dentro, así que la base sale de
 * dividir: base = total / (1 + tipo). El descuento se reparte entre los tipos en proporción.
 * La suma de los totales del desglose coincide siempre con el total del ticket.
 */
export function desgloseIva(lineas: LineaTicket[], descuento: number): DesgloseIva[] {
  const porTipo = new Map<number, Centimos>();
  for (const l of lineas) porTipo.set(l.iva, (porTipo.get(l.iva) ?? 0) + l.importe);
  const bruto = [...porTipo.values()].reduce((s, v) => s + v, 0);
  const totalFinal = aplicarDescuento(bruto, descuento);
  const tipos = [...porTipo.keys()].sort((a, b) => a - b);
  const desglose: DesgloseIva[] = [];
  let repartido = 0;
  tipos.forEach((tipo, i) => {
    const bruta = porTipo.get(tipo) ?? 0;
    const total =
      i === tipos.length - 1
        ? totalFinal - repartido
        : bruto === 0
          ? 0
          : Math.round((bruta * totalFinal) / bruto);
    repartido += total;
    const base = Math.round(total / (1 + tipo / 100));
    desglose.push({ tipo, base, cuota: total - base, total });
  });
  return desglose;
}

export function totalPagos(pagos: Pago[]): Centimos {
  return pagos.reduce((s, p) => s + p.importe, 0);
}

/**
 * Cambio que hay que devolver. Solo se devuelve cambio del efectivo: si alguien paga 20 € con
 * tarjeta y la cuenta es de 15 €, eso es un error, no un cambio.
 */
export function calcularCambio(total: Centimos, pagos: Pago[]): Centimos {
  const entregado = totalPagos(pagos);
  if (entregado <= total) return 0;
  const efectivo = pagos.filter((p) => p.metodo === "efectivo").reduce((s, p) => s + p.importe, 0);
  return Math.min(entregado - total, efectivo);
}

/** Reparte un total entre `partes` personas sin perder céntimos (los primeros pagan 1 más). */
export function dividirEnPartes(total: Centimos, partes: number): Centimos[] {
  const n = Math.max(1, Math.floor(partes));
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}
