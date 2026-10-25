import { fechaAeat, fechaHoraConHuso } from "../fechas";
import { activa } from "./funciones";
import { calcularHuella, importeAeat } from "./huella";
import type { EstadoRegistroAeat, Estado, RegistroAeat, Ticket } from "./tipos";

/**
 * VERI*FACTU (RD 1007/2023 y Orden HAC/1177/2024): cada ticket genera un registro de alta con
 * su huella encadenada, lleva un QR con la dirección de cotejo de la AEAT y se manda a la AEAT al
 * momento. Aquí está la parte pura (sin red): sellar el ticket, el QR y apuntar las respuestas.
 */

export type EntornoAeat = "pruebas" | "produccion";

const COTEJO: Record<EntornoAeat, string> = {
  pruebas: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  produccion: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
};

/** La dirección que va en el QR del ticket para que el cliente lo compruebe en la AEAT. */
export function urlCotejo(
  datos: { nif: string; numero: string; fechaExpedicion: string; importeTotal: number },
  entorno: EntornoAeat = "pruebas",
): string {
  const parametros = [
    ["nif", datos.nif.trim().toUpperCase()],
    ["numserie", datos.numero],
    ["fecha", datos.fechaExpedicion],
    ["importe", importeAeat(datos.importeTotal)],
  ];
  return `${COTEJO[entorno]}?${parametros.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&")}`;
}

/** Lo que falta en un ticket recién hecho: huella, tipo, momento y, con VERI*FACTU, su QR. */
type SinSellar = Omit<Ticket, "huella" | "tipoFactura" | "generadoEn" | "urlQr">;

/** Registros ya contestados que se guardan (los pendientes se guardan todos). */
const MAX_REGISTROS_HECHOS = 300;

/**
 * Pone la huella al ticket y lo añade al estado. Con VERI*FACTU encendido, además le pone el QR
 * de cotejo y deja su registro listo para mandar a la AEAT.
 */
export function sellarTicket(
  estado: Estado,
  ticket: SinSellar,
  ahora: string,
  entorno?: EntornoAeat,
): Ticket {
  const fechaExpedicion = fechaAeat(ahora);
  const tipoFactura = ticket.rectificaA ? "R5" : "F2";
  const generadoEn = fechaHoraConHuso(ahora);
  const cuotaTotal = ticket.desglose.reduce((s, d) => s + d.cuota, 0);
  const verifactu = activa(estado.ajustes, "verifactu");
  const sellado: Ticket = {
    ...ticket,
    tipoFactura,
    generadoEn,
    huella: calcularHuella({
      nif: estado.ajustes.nif,
      numero: ticket.numero,
      fechaExpedicion,
      tipoFactura,
      cuotaTotal,
      importeTotal: ticket.total,
      huellaAnterior: ticket.huellaAnterior,
      generadoEn,
    }),
    ...(verifactu
      ? {
          urlQr: urlCotejo(
            {
              nif: estado.ajustes.nif,
              numero: ticket.numero,
              fechaExpedicion,
              importeTotal: ticket.total,
            },
            entorno,
          ),
        }
      : {}),
  };
  const anterior = estado.tickets.at(-1);
  estado.tickets.push(sellado);
  if (verifactu) {
    const rectificado = ticket.rectificaA
      ? estado.tickets.find((t) => t.id === ticket.rectificaA)
      : undefined;
    const registros = estado.verifactu?.registros ?? [];
    registros.push({
      ticketId: sellado.id,
      numero: sellado.numero,
      fechaExpedicion,
      tipoFactura,
      desglose: sellado.desglose,
      cuotaTotal,
      importeTotal: sellado.total,
      huella: sellado.huella,
      generadoEn,
      anterior: anterior
        ? {
            numero: anterior.numero,
            fechaExpedicion: fechaAeat(anterior.fecha),
            huella: anterior.huella,
          }
        : null,
      ...(rectificado
        ? {
            rectifica: {
              numero: rectificado.numero,
              fechaExpedicion: fechaAeat(rectificado.fecha),
            },
          }
        : {}),
      estado: "pendiente",
    });
    estado.verifactu = { ...estado.verifactu, registros };
  }
  return sellado;
}

/** Lo que hay que mandar ya (si la AEAT no ha pedido esperar). Como mucho 1000 por envío. */
export function porEnviar(estado: Pick<Estado, "verifactu">, ahora: string): RegistroAeat[] {
  const v = estado.verifactu;
  if (!v || (v.esperarHasta && v.esperarHasta > ahora)) return [];
  return v.registros.filter((r) => r.estado === "pendiente").slice(0, 1000);
}

export type RespuestaAeat = {
  /** Correcto, ParcialmenteCorrecto o Incorrecto. */
  estadoEnvio: string;
  csv?: string;
  /** Segundos que pide esperar antes del siguiente envío. */
  esperar: number;
  lineas: { numero: string; estado: string; codigo?: number; descripcion?: string }[];
};

/** Código de la AEAT para un registro que ya tenía: cuenta como enviado. */
const DUPLICADO = 3000;

/** Apunta en cada registro lo que ha contestado la AEAT. */
export function apuntarRespuesta(
  estado: Estado,
  enviados: string[],
  respuesta: RespuestaAeat,
  ahora: string,
): Estado {
  const registros = (estado.verifactu?.registros ?? []).map((r) => {
    if (!enviados.includes(r.ticketId)) return r;
    const linea = respuesta.lineas.find((l) => l.numero === r.numero);
    if (!linea) return r;
    const nuevo: EstadoRegistroAeat =
      linea.estado === "Correcto" || linea.codigo === DUPLICADO
        ? "correcto"
        : linea.estado === "AceptadoConErrores"
          ? "aceptado_con_errores"
          : "incorrecto";
    const { error: _e, ...resto } = r;
    void _e;
    return {
      ...resto,
      estado: nuevo,
      enviadoEn: ahora,
      ...(respuesta.csv ? { csv: respuesta.csv } : {}),
      ...(nuevo !== "correcto" && linea.descripcion
        ? { error: `${linea.codigo ?? ""} ${linea.descripcion}`.trim() }
        : {}),
    };
  });
  const hechos = registros.filter((r) => r.estado !== "pendiente");
  const sobran = new Set(
    hechos.slice(0, Math.max(0, hechos.length - MAX_REGISTROS_HECHOS)).map((r) => r.ticketId),
  );
  return {
    ...estado,
    verifactu: {
      registros: registros.filter((r) => !sobran.has(r.ticketId)),
      esperarHasta: new Date(Date.parse(ahora) + respuesta.esperar * 1000).toISOString(),
    },
  };
}

/**
 * Antes de mandar se aparta el turno: nadie más manda en el próximo minuto (así dos pantallas no
 * mandan lo mismo a la vez). Si falla la conexión, se apunta el motivo y se reintenta luego.
 */
export function reservarEnvio(estado: Estado, ahora: string, segundos = 60): Estado {
  return {
    ...estado,
    verifactu: {
      registros: estado.verifactu?.registros ?? [],
      ...estado.verifactu,
      esperarHasta: new Date(Date.parse(ahora) + segundos * 1000).toISOString(),
    },
  };
}

export function apuntarFallo(estado: Estado, motivo: string): Estado {
  return {
    ...estado,
    verifactu: {
      registros: estado.verifactu?.registros ?? [],
      ...estado.verifactu,
      ultimoError: motivo,
    },
  };
}

/** Un registro rechazado se puede volver a mandar (corregido) como subsanación. */
export function reintentar(estado: Estado, ticketId: string): Estado {
  return {
    ...estado,
    verifactu: {
      ...estado.verifactu,
      registros: (estado.verifactu?.registros ?? []).map((r) =>
        r.ticketId === ticketId && r.estado === "incorrecto" ? { ...r, estado: "pendiente" } : r,
      ),
    },
  };
}
