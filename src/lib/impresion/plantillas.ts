import { resumenTurno } from "../dominio/caja";
import { euros, lineasDeTicket, totalCuenta } from "../dominio/importes";
import type {
  Ajustes,
  Cuenta,
  Destino,
  Empleado,
  Estado,
  LineaCuenta,
  Mesa,
  Ticket,
  TurnoCaja,
} from "../dominio/tipos";
import { formatearFechaHora, formatearHora } from "../fechas";
import type { Bloque } from "./documento";

const NOMBRE_METODO = { efectivo: "Efectivo", tarjeta: "Tarjeta", bizum: "Bizum", otro: "Otro" };

function cabeceraLocal(ajustes: Ajustes): Bloque[] {
  const bloques: Bloque[] = [
    { tipo: "texto", texto: ajustes.nombreLocal, alinear: "centro", negrita: true, grande: true },
  ];
  if (ajustes.razonSocial)
    bloques.push({ tipo: "texto", texto: ajustes.razonSocial, alinear: "centro" });
  if (ajustes.nif) bloques.push({ tipo: "texto", texto: `NIF ${ajustes.nif}`, alinear: "centro" });
  if (ajustes.direccion)
    bloques.push({ tipo: "texto", texto: ajustes.direccion, alinear: "centro" });
  if (ajustes.telefono)
    bloques.push({ tipo: "texto", texto: `Tel. ${ajustes.telefono}`, alinear: "centro" });
  return bloques;
}

/**
 * Comanda para cocina o barra: grande, sin precios y con las notas bien visibles, que es lo que
 * se lee de un vistazo con las manos ocupadas.
 */
export function plantillaComanda(datos: {
  mesa: Mesa;
  destino: Destino;
  lineas: LineaCuenta[];
  ronda: number;
  camarero: string;
  comensales: number;
  fecha: string;
  /** Comanda de «marcha»: lo que estaba en espera, a prepararse ya. */
  marcha?: boolean;
}): Bloque[] {
  const bloques: Bloque[] = [
    {
      tipo: "texto",
      texto: `${datos.marcha ? "¡MARCHA! " : ""}${datos.destino === "cocina" ? "COCINA" : "BARRA"}`,
      alinear: "centro",
      negrita: true,
    },
    {
      tipo: "texto",
      texto: datos.mesa.nombre.toUpperCase(),
      alinear: "centro",
      grande: true,
      negrita: true,
    },
    {
      tipo: "texto",
      texto: `Ronda ${datos.ronda} · ${formatearHora(datos.fecha)} · ${datos.comensales} pax`,
      alinear: "centro",
    },
    { tipo: "texto", texto: `Camarero: ${datos.camarero}`, alinear: "centro" },
    { tipo: "separador", caracter: "=" },
  ];
  const escribir = (l: LineaCuenta) => {
    bloques.push({
      tipo: "texto",
      texto: `${l.cantidad} x ${l.nombre}`,
      negrita: true,
      grande: true,
    });
    for (const o of l.opciones) bloques.push({ tipo: "texto", texto: `   > ${o.nombre}` });
    if (l.nota) bloques.push({ tipo: "texto", texto: `   ¡${l.nota}!`, negrita: true });
    if (l.origen === "qr") bloques.push({ tipo: "texto", texto: "   (pedido desde el QR)" });
  };
  const ahora = datos.marcha ? datos.lineas : datos.lineas.filter((l) => l.estado !== "en_espera");
  const despues = datos.marcha ? [] : datos.lineas.filter((l) => l.estado === "en_espera");
  ahora.forEach(escribir);
  if (despues.length) {
    bloques.push(
      { tipo: "separador" },
      {
        tipo: "texto",
        texto: "PARA DESPUÉS · esperar la marcha",
        alinear: "centro",
        negrita: true,
      },
    );
    despues.forEach(escribir);
  }
  bloques.push(
    { tipo: "separador", caracter: "=" },
    { tipo: "espacio", lineas: 3 },
    { tipo: "corte" },
  );
  return bloques;
}

/** Cuenta antes de cobrar (la «precuenta»): con precios, pero sin número de ticket. */
export function plantillaPrecuenta(datos: {
  ajustes: Ajustes;
  mesa: Mesa;
  cuenta: Cuenta;
  fecha: string;
}): Bloque[] {
  const { cuenta } = datos;
  const lineas = lineasDeTicket(cuenta);
  const subtotal = lineas.reduce((s, l) => s + l.importe, 0);
  const total = totalCuenta(cuenta);
  const bloques: Bloque[] = [
    ...cabeceraLocal(datos.ajustes),
    { tipo: "separador" },
    { tipo: "texto", texto: "CUENTA (no es factura)", alinear: "centro", negrita: true },
    {
      tipo: "texto",
      texto: `${datos.mesa.nombre} · ${formatearFechaHora(datos.fecha)}`,
      alinear: "centro",
    },
    { tipo: "separador" },
    ...lineas.map((l): Bloque => ({
      tipo: "par",
      izquierda: `${l.cantidad} ${l.nombre}`,
      derecha: euros(l.importe),
    })),
    { tipo: "separador" },
  ];
  if (cuenta.descuento || cuenta.descuentoImporte) {
    const trasPorcentaje = total + (cuenta.descuentoImporte ?? 0);
    bloques.push({ tipo: "par", izquierda: "Subtotal", derecha: euros(subtotal) });
    if (cuenta.descuento)
      bloques.push({
        tipo: "par",
        izquierda: `Descuento ${cuenta.descuento} %`,
        derecha: euros(trasPorcentaje - subtotal),
      });
    if (cuenta.descuentoImporte)
      bloques.push({
        tipo: "par",
        izquierda: "Descuento",
        derecha: euros(-cuenta.descuentoImporte),
      });
  }
  bloques.push({ tipo: "par", izquierda: "TOTAL", derecha: euros(total), negrita: true });
  if (cuenta.comensales > 1) {
    bloques.push({
      tipo: "par",
      izquierda: `Entre ${cuenta.comensales}`,
      derecha: `${euros(Math.ceil(total / cuenta.comensales))} c/u`,
    });
  }
  bloques.push({ tipo: "espacio", lineas: 3 }, { tipo: "corte" });
  return bloques;
}

/** Factura simplificada, con lo que pide el Reglamento de facturación (RD 1619/2012, art. 7). */
export function plantillaTicket(datos: {
  ajustes: Ajustes;
  ticket: Ticket;
  camarero?: Empleado;
  abrirCajon?: boolean;
  /** Con VERI*FACTU, la dirección de cotejo de la AEAT (sale en un QR con la leyenda). */
  urlQr?: string;
  /** Enlace para dejar una reseña (sale con su propio QR al pie). */
  resena?: string;
}): Bloque[] {
  const { ticket: t } = datos;
  const subtotal = t.lineas.reduce((s, l) => s + l.importe, 0);
  const bloques: Bloque[] = [
    ...(datos.abrirCajon ? ([{ tipo: "cajon" }] as Bloque[]) : []),
    ...cabeceraLocal(datos.ajustes),
    { tipo: "separador" },
    {
      tipo: "texto",
      texto: t.rectificaA ? "FACTURA SIMPLIFICADA RECTIFICATIVA" : "FACTURA SIMPLIFICADA",
      alinear: "centro",
      negrita: true,
    },
    { tipo: "par", izquierda: `Nº ${t.numero}`, derecha: formatearFechaHora(t.fecha) },
    {
      tipo: "par",
      izquierda: t.mesaNombre,
      derecha: datos.camarero ? `Le atendió: ${datos.camarero.nombre}` : "",
    },
    { tipo: "separador" },
  ];
  for (const l of t.lineas) {
    bloques.push({
      tipo: "par",
      izquierda: `${l.cantidad} ${l.nombre}`,
      derecha: euros(l.importe),
    });
    if (l.cantidad > 1)
      bloques.push({ tipo: "texto", texto: `   ${euros(l.precioUnitario)} / ud.` });
  }
  bloques.push({ tipo: "separador" });
  if (t.descuento || t.descuentoImporte) {
    const trasPorcentaje = t.total + (t.descuentoImporte ?? 0);
    bloques.push({ tipo: "par", izquierda: "Subtotal", derecha: euros(subtotal) });
    if (t.descuento)
      bloques.push({
        tipo: "par",
        izquierda: `Descuento ${t.descuento} %`,
        derecha: euros(trasPorcentaje - subtotal),
      });
    if (t.descuentoImporte)
      bloques.push({ tipo: "par", izquierda: "Descuento", derecha: euros(-t.descuentoImporte) });
  }
  bloques.push({
    tipo: "par",
    izquierda: "TOTAL (IVA incluido)",
    derecha: euros(t.total),
    negrita: true,
  });
  for (const d of t.desglose) {
    bloques.push({
      tipo: "par",
      izquierda: `  IVA ${d.tipo} %  base ${euros(d.base)}`,
      derecha: `cuota ${euros(d.cuota)}`,
    });
  }
  bloques.push({ tipo: "separador" });
  for (const p of t.pagos)
    bloques.push({ tipo: "par", izquierda: NOMBRE_METODO[p.metodo], derecha: euros(p.importe) });
  if (t.propina) {
    bloques.push({
      tipo: "par",
      izquierda: "Propina (fuera de la factura)",
      derecha: euros(t.propina),
    });
  }
  if (t.cambio) bloques.push({ tipo: "par", izquierda: "Cambio", derecha: euros(t.cambio) });
  if (datos.urlQr) {
    // QR tributario y leyenda de VERI*FACTU (Orden HAC/1177/2024, arts. 20 y 21).
    bloques.push(
      { tipo: "espacio" },
      { tipo: "texto", texto: "QR tributario:", alinear: "centro" },
      { tipo: "qr", datos: datos.urlQr },
      { tipo: "texto", texto: "VERI*FACTU", alinear: "centro", negrita: true },
    );
  }
  if (datos.ajustes.pieTicket) {
    bloques.push(
      { tipo: "espacio" },
      { tipo: "texto", texto: datos.ajustes.pieTicket, alinear: "centro" },
    );
  }
  if (datos.resena) {
    bloques.push(
      { tipo: "espacio" },
      { tipo: "texto", texto: "¿Qué tal? Déjanos tu opinión:", alinear: "centro" },
      { tipo: "qr", datos: datos.resena },
    );
  }
  bloques.push(
    { tipo: "texto", texto: `Huella ${t.huella.slice(0, 16)}`, alinear: "centro" },
    { tipo: "espacio", lineas: 3 },
    { tipo: "corte" },
  );
  return bloques;
}

/** Informe Z: el cierre de caja del turno. */
export function plantillaCierre(datos: {
  ajustes: Ajustes;
  estado: Pick<Estado, "tickets">;
  turno: TurnoCaja;
}): Bloque[] {
  const r = resumenTurno(datos.estado, datos.turno);
  const t = datos.turno;
  const bloques: Bloque[] = [
    ...cabeceraLocal(datos.ajustes),
    { tipo: "separador" },
    { tipo: "texto", texto: `CIERRE DE CAJA (Z) Nº ${t.numero}`, alinear: "centro", negrita: true },
    { tipo: "par", izquierda: "Apertura", derecha: formatearFechaHora(t.abiertoEn) },
    {
      tipo: "par",
      izquierda: "Cierre",
      derecha: t.cerradoEn ? formatearFechaHora(t.cerradoEn) : "—",
    },
    { tipo: "separador" },
    { tipo: "par", izquierda: "Tickets", derecha: String(r.tickets) },
    { tipo: "par", izquierda: "Ventas (IVA incl.)", derecha: euros(r.ventas), negrita: true },
    ...(r.propinas
      ? [{ tipo: "par", izquierda: "Propinas", derecha: euros(r.propinas) } as Bloque]
      : []),
    ...r.desglose.map((d): Bloque => ({
      tipo: "par",
      izquierda: `  IVA ${d.tipo} %  base ${euros(d.base)}`,
      derecha: `cuota ${euros(d.cuota)}`,
    })),
    { tipo: "separador" },
    ...(Object.keys(NOMBRE_METODO) as (keyof typeof NOMBRE_METODO)[]).map((m): Bloque => ({
      tipo: "par",
      izquierda: NOMBRE_METODO[m],
      derecha: euros(r.porMetodo[m]),
    })),
    { tipo: "separador" },
    { tipo: "par", izquierda: "Fondo inicial", derecha: euros(t.fondoInicial) },
    { tipo: "par", izquierda: "Entradas", derecha: euros(r.entradas) },
    { tipo: "par", izquierda: "Salidas", derecha: `-${euros(r.salidas)}` },
    {
      tipo: "par",
      izquierda: "Efectivo esperado",
      derecha: euros(r.efectivoEsperado),
      negrita: true,
    },
  ];
  if (t.efectivoContado !== null) {
    bloques.push(
      { tipo: "par", izquierda: "Efectivo contado", derecha: euros(t.efectivoContado) },
      { tipo: "par", izquierda: "Descuadre", derecha: euros(r.descuadre ?? 0), negrita: true },
    );
  }
  bloques.push({ tipo: "espacio", lineas: 3 }, { tipo: "corte" });
  return bloques;
}

export function plantillaPrueba(nombreImpresora: string, fecha: string): Bloque[] {
  return [
    { tipo: "texto", texto: "PRUEBA DE IMPRESIÓN", alinear: "centro", negrita: true, grande: true },
    { tipo: "texto", texto: nombreImpresora, alinear: "centro" },
    { tipo: "texto", texto: formatearFechaHora(fecha), alinear: "centro" },
    { tipo: "separador" },
    { tipo: "texto", texto: "Tildes y eñes: áéíóú ÁÉÍÓÚ ñÑ ¿¡ ü €" },
    { tipo: "par", izquierda: "Una caña", derecha: euros(200) },
    { tipo: "texto", texto: "Si lees esto bien, ¡ya está lista!", alinear: "centro" },
    { tipo: "espacio", lineas: 3 },
    { tipo: "corte" },
  ];
}
