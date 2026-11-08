/**
 * Declaración responsable del sistema informático de facturación (art. 13 RD 1007/2023 y art. 15
 * de la Orden HAC/1177/2024). El contenido y el orden de los datos son los del art. 15.1; cada
 * dato va precedido del texto que lo describe. Tiene que poder leerse dentro del propio programa
 * (art. 15.3): se enseña en /declaracion-responsable y se enlaza desde Gestión → VERI*FACTU.
 */

/** Lo que el programa dice de sí mismo, igual aquí que en los envíos a la AEAT. */
export const SISTEMA = {
  nombre: "Comanda",
  /** Código de 2 caracteres (apartado 2.6 del anexo). */
  id: "CM",
  version: "1.0",
} as const;

export type DatosProductor = {
  nombre?: string;
  nif?: string;
  direccion?: string;
  /** Cuándo y dónde se firma: «05-11-2026» y «Sevilla, España». */
  fecha?: string;
  lugar?: string;
  correo?: string;
  web?: string;
};

export function productorDe(entorno: Record<string, string | undefined>): DatosProductor {
  return {
    nombre: entorno.VERIFACTU_PRODUCTOR_NOMBRE,
    nif: entorno.VERIFACTU_PRODUCTOR_NIF,
    direccion: entorno.VERIFACTU_PRODUCTOR_DIRECCION,
    fecha: entorno.DECLARACION_FECHA,
    lugar: entorno.DECLARACION_LUGAR,
    correo: entorno.LEGAL_TITULAR_CORREO,
    web: entorno.DECLARACION_WEB,
  };
}

export type Declaracion = {
  titulo: string;
  datos: { letra: string; texto: string; valor: string }[];
  anexo: { titulo: string; parrafos: string[] }[];
  /** Lo que falta para poder firmarla (si está vacío, está completa). */
  faltan: string[];
};

const PENDIENTE = "[pendiente]";

export function declaracionResponsable(p: DatosProductor, multiplesBares: boolean): Declaracion {
  const faltan = [
    !p.nombre && "VERIFACTU_PRODUCTOR_NOMBRE",
    !p.nif && "VERIFACTU_PRODUCTOR_NIF",
    !p.direccion && "VERIFACTU_PRODUCTOR_DIRECCION",
    !p.fecha && "DECLARACION_FECHA",
    !p.lugar && "DECLARACION_LUGAR",
  ].filter(Boolean) as string[];
  const datos = [
    { letra: "a", texto: "Nombre del sistema informático", valor: SISTEMA.nombre },
    { letra: "b", texto: "Código identificador del sistema informático", valor: SISTEMA.id },
    {
      letra: "c",
      texto: "Identificador completo de la versión concreta del sistema informático",
      valor: SISTEMA.version,
    },
    {
      letra: "d",
      texto:
        "Componentes, hardware y software, de que consta el sistema informático, junto con una " +
        "breve descripción de lo que hace y de sus principales funcionalidades",
      valor:
        "Software: aplicación web (servidor Next.js alojado en Vercel y base de datos Supabase " +
        "en la Unión Europea) que se usa desde el navegador de móviles, tabletas y ordenadores; " +
        "programa opcional «puente de impresión» para enviar los tickets a impresoras del local. " +
        "No incluye hardware propio: funciona con los aparatos y las impresoras de tickets " +
        "(ESC/POS) del establecimiento. Es un terminal punto de venta para hostelería: toma de " +
        "comandas en mesa, carta con pedidos por QR, cocina, cobro y emisión de facturas " +
        "simplificadas (tickets) y sus rectificativas, caja y cierres, informes, stock y equipo. " +
        "Cada ticket genera su registro de facturación encadenado con huella, se imprime con el " +
        "código QR tributario y se remite a la AEAT.",
    },
    {
      letra: "e",
      texto:
        "Indicación de si el sistema informático se ha producido de tal manera que solo pueda " +
        "funcionar exclusivamente como «VERI*FACTU»",
      valor: "Sí",
    },
    {
      letra: "f",
      texto:
        "Indicación de si el sistema informático permite ser usado por varios obligados " +
        "tributarios o por un mismo usuario para dar soporte a la facturación de varios " +
        "obligados tributarios",
      valor: multiplesBares
        ? "Sí: varios obligados tributarios (cada establecimiento, con sus datos separados)"
        : "No",
    },
    {
      letra: "g",
      texto:
        "Tipos de firma utilizados para firmar los registros de facturación y de evento en el " +
        "caso de que el sistema informático no sea utilizado como «VERI*FACTU»",
      valor: "No aplica: el sistema solo funciona como «VERI*FACTU»",
    },
    {
      letra: "h",
      texto: "Nombre y apellidos o razón social de la persona o entidad productora",
      valor: p.nombre || PENDIENTE,
    },
    {
      letra: "i",
      texto: "Número de identificación fiscal (NIF) español de la persona o entidad productora",
      valor: p.nif || PENDIENTE,
    },
    {
      letra: "j",
      texto: "Dirección postal completa de contacto de la persona o entidad productora",
      valor: p.direccion || PENDIENTE,
    },
    {
      letra: "k",
      texto: "Declaración de cumplimiento",
      valor:
        `${p.nombre || PENDIENTE} declara que el sistema informático ${SISTEMA.nombre}, en su ` +
        `versión ${SISTEMA.version}, cumple con lo dispuesto en el artículo 29.2.j) de la Ley ` +
        "58/2003, de 17 de diciembre, General Tributaria, en el Reglamento que establece los " +
        "requisitos que deben adoptar los sistemas y programas informáticos o electrónicos que " +
        "soporten los procesos de facturación de empresarios y profesionales, y la " +
        "estandarización de formatos de los registros de facturación, aprobado por el Real " +
        "Decreto 1007/2023, de 5 de diciembre, en la Orden HAC/1177/2024, de 17 de octubre, y en " +
        "la sede electrónica de la Agencia Estatal de Administración Tributaria para todo aquello " +
        "que complete las especificaciones de dicha orden.",
    },
    {
      letra: "l",
      texto: "Fecha y lugar en los que se suscribe la declaración responsable",
      valor: `${p.fecha || PENDIENTE}, ${p.lugar || PENDIENTE}`,
    },
  ];
  const contacto = [p.correo && `Correo: ${p.correo}`, p.web && `Web: ${p.web}`].filter(
    Boolean,
  ) as string[];
  const anexo = [
    ...(contacto.length ? [{ titulo: "Otras formas de contacto", parrafos: contacto }] : []),
    {
      titulo: "Cómo cumple las especificaciones",
      parrafos: [
        "Integridad e inalterabilidad: los tickets no se editan ni se borran; los errores se " +
          "corrigen con facturas rectificativas por diferencias (R5).",
        "Trazabilidad: cada registro de alta incluye la huella SHA-256 del anterior, calculada " +
          "como indica la AEAT (comprobada con su ejemplo oficial).",
        "Remisión: los registros se envían a la AEAT por el servicio web SOAP con el " +
          "certificado del obligado tributario, respetando el tiempo de espera que indique la " +
          "AEAT; los que no se pueden enviar quedan pendientes y se reintentan.",
        "QR tributario: cada ticket impreso lleva el código QR de cotejo con la URL de la AEAT y " +
          "la leyenda «VERI*FACTU».",
        "Formato: el XML se ha validado con el esquema oficial (SuministroLR.xsd).",
      ],
    },
  ];
  return {
    titulo: "DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN",
    datos,
    anexo,
    faltan,
  };
}

/** La declaración en texto plano (para descargarla o imprimirla). */
export function declaracionEnTexto(d: Declaracion): string {
  return [
    d.titulo,
    "",
    ...d.datos.map((x) => `${x.letra}) ${x.texto}: ${x.valor}`),
    "",
    "ANEXO",
    ...d.anexo.flatMap((s) => ["", s.titulo, ...s.parrafos.map((p) => `- ${p}`)]),
    "",
  ].join("\n");
}
