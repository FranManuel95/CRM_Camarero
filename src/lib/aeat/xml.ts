import { importeAeat } from "../dominio/huella";
import type { RespuestaAeat } from "../dominio/verifactu";
import type { RegistroAeat } from "../dominio/tipos";

/**
 * El XML que se manda a la AEAT (RegFactuSistemaFacturacion, SuministroLR.xsd) y la lectura de
 * su respuesta. El orden de los elementos es el del esquema oficial: no se puede cambiar.
 */

const BASE =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/";
const NS_LR = `${BASE}SuministroLR.xsd`;
const NS_SF = `${BASE}SuministroInformacion.xsd`;

/** El bar que expide los tickets. */
export type Obligado = { nombre: string; nif: string };

/** El programa (Comanda) y quien lo fabrica, como pide el bloque SistemaInformatico. */
export type SistemaInformatico = {
  nombreFabricante: string;
  nifFabricante: string;
  /** Identificador del bar en esta instalación. */
  numeroInstalacion: string;
  version: string;
  /** En la nube, el mismo programa lo usan varios bares. */
  multiplesBares: boolean;
};

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;",
  );

/** <sum1:Nombre>texto</sum1:Nombre>, con el texto escapado. */
const e = (nombre: string, contenido: string) => `<sum1:${nombre}>${contenido}</sum1:${nombre}>`;
const t = (nombre: string, texto: string) => e(nombre, escapar(texto));

const sistema = (s: SistemaInformatico) =>
  e(
    "SistemaInformatico",
    t("NombreRazon", s.nombreFabricante) +
      t("NIF", s.nifFabricante) +
      t("NombreSistemaInformatico", "Comanda") +
      t("IdSistemaInformatico", "CM") +
      t("Version", s.version) +
      t("NumeroInstalacion", s.numeroInstalacion) +
      t("TipoUsoPosibleSoloVerifactu", "S") +
      t("TipoUsoPosibleMultiOT", s.multiplesBares ? "S" : "N") +
      t("IndicadorMultiplesOT", "N"),
  );

/** Un registro de alta de un ticket (factura simplificada F2 o su rectificativa R5). */
export function registroAlta(r: RegistroAeat, obligado: Obligado, s: SistemaInformatico): string {
  const desglose = r.desglose
    .map((d) =>
      e(
        "DetalleDesglose",
        t("Impuesto", "01") +
          t("ClaveRegimen", "01") +
          t("CalificacionOperacion", "S1") +
          t("TipoImpositivo", d.tipo.toFixed(2)) +
          t("BaseImponibleOimporteNoSujeto", importeAeat(d.base)) +
          t("CuotaRepercutida", importeAeat(d.cuota)),
      ),
    )
    .join("");
  const encadenamiento = r.anterior
    ? e(
        "RegistroAnterior",
        t("IDEmisorFactura", obligado.nif) +
          t("NumSerieFactura", r.anterior.numero) +
          t("FechaExpedicionFactura", r.anterior.fechaExpedicion) +
          t("Huella", r.anterior.huella),
      )
    : t("PrimerRegistro", "S");
  return (
    "<sum:RegistroFactura>" +
    e(
      "RegistroAlta",
      t("IDVersion", "1.0") +
        e(
          "IDFactura",
          t("IDEmisorFactura", obligado.nif) +
            t("NumSerieFactura", r.numero) +
            t("FechaExpedicionFactura", r.fechaExpedicion),
        ) +
        t("NombreRazonEmisor", obligado.nombre) +
        t("TipoFactura", r.tipoFactura) +
        (r.rectifica
          ? t("TipoRectificativa", "I") +
            e(
              "FacturasRectificadas",
              e(
                "IDFacturaRectificada",
                t("IDEmisorFactura", obligado.nif) +
                  t("NumSerieFactura", r.rectifica.numero) +
                  t("FechaExpedicionFactura", r.rectifica.fechaExpedicion),
              ),
            )
          : "") +
        t("DescripcionOperacion", r.rectifica ? "Devolución de consumiciones" : "Consumiciones") +
        e("Desglose", desglose) +
        t("CuotaTotal", importeAeat(r.cuotaTotal)) +
        t("ImporteTotal", importeAeat(r.importeTotal)) +
        e("Encadenamiento", encadenamiento) +
        sistema(s) +
        t("FechaHoraHusoGenRegistro", r.generadoEn) +
        t("TipoHuella", "01") +
        t("Huella", r.huella),
    ) +
    "</sum:RegistroFactura>"
  );
}

/** El sobre SOAP completo con la cabecera y hasta 1000 registros. */
export function sobreSoap(
  registros: RegistroAeat[],
  obligado: Obligado,
  s: SistemaInformatico,
): string {
  if (!registros.length || registros.length > 1000)
    throw new Error("Un envío lleva entre 1 y 1000 registros.");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${NS_LR}" xmlns:sum1="${NS_SF}">` +
    "<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion>" +
    "<sum:Cabecera>" +
    e("ObligadoEmision", t("NombreRazon", obligado.nombre) + t("NIF", obligado.nif)) +
    "</sum:Cabecera>" +
    registros.map((r) => registroAlta(r, obligado, s)).join("") +
    "</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>"
  );
}

/** El texto del primer elemento con ese nombre (con o sin prefijo), o undefined. */
function texto(xml: string, nombre: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${nombre}>([^<]*)</(?:[\\w-]+:)?${nombre}>`));
  return m?.[1]?.trim();
}

/** Todos los bloques con ese nombre. */
function bloques(xml: string, nombre: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${nombre}>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1] ?? "");
}

export class ErrorAeat extends Error {}

/** Lee la respuesta de la AEAT. Si es un error SOAP (Fault), lanza ErrorAeat con su mensaje. */
export function leerRespuesta(xml: string): RespuestaAeat {
  if (/<(?:[\w-]+:)?Fault>/.test(xml))
    throw new ErrorAeat(texto(xml, "faultstring") ?? "La AEAT ha rechazado el envío.");
  const estadoEnvio = texto(xml, "EstadoEnvio");
  if (!estadoEnvio) throw new ErrorAeat("La respuesta de la AEAT no se entiende.");
  const codigo = (l: string) => {
    const c = texto(l, "CodigoErrorRegistro");
    return c ? Number(c) : undefined;
  };
  return {
    estadoEnvio,
    csv: texto(xml, "CSV"),
    esperar: Number(texto(xml, "TiempoEsperaEnvio") ?? 60),
    lineas: bloques(xml, "RespuestaLinea").map((l) => ({
      numero: texto(l, "NumSerieFactura") ?? "",
      estado: texto(l, "EstadoRegistro") ?? "",
      codigo: codigo(l),
      descripcion: texto(l, "DescripcionErrorRegistro"),
    })),
  };
}
