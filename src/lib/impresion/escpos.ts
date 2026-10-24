import { type Bloque, lineaPar, partirTexto } from "./documento";

/**
 * Codificador ESC/POS: el «idioma» que entienden casi todas las impresoras térmicas de tickets
 * (Epson TM, Star en modo compatible, Bixolon, Xprinter, Sunmi, las chinas de 30 €…).
 * Genera los bytes; mandarlos a la impresora es cosa del transporte (red, USB o Bluetooth).
 */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Página de códigos 858 (la 850 de Europa occidental con el €). En las Epson es la tabla 19.
 * Solo están los caracteres que salen en una carta en español; el resto se cambia por su
 * letra sin tilde o por «?».
 */
const CP858: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  Ä: 0x8e,
  É: 0x90,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  Ö: 0x99,
  Ü: 0x9a,
  "×": 0x9e,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  ª: 0xa6,
  º: 0xa7,
  "¿": 0xa8,
  "½": 0xab,
  "¡": 0xad,
  "«": 0xae,
  "»": 0xaf,
  Á: 0xb5,
  Â: 0xb6,
  À: 0xb7,
  "€": 0xd5,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  "·": 0xfa,
  "°": 0xf8,
};

const SUSTITUTOS: Record<string, string> = {
  "✂": "-",
  "…": "...",
  "–": "-",
  "—": "-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  " ": " ",
};

export function codificarTexto(texto: string): number[] {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const c = SUSTITUTOS[caracter] ?? caracter;
    for (const ch of c) {
      const codigo = ch.codePointAt(0) ?? 63;
      if (codigo >= 0x20 && codigo < 0x7f) bytes.push(codigo);
      else if (ch === "\n") bytes.push(0x0a);
      else if (CP858[ch] !== undefined) bytes.push(CP858[ch]);
      else {
        const sinTilde = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
        const c0 = sinTilde.codePointAt(0) ?? 63;
        bytes.push(c0 >= 0x20 && c0 < 0x7f ? c0 : 0x3f);
      }
    }
  }
  return bytes;
}

const ALINEACION = { izquierda: 0, centro: 1, derecha: 2 } as const;

function qr(datos: string): number[] {
  const contenido = codificarTexto(datos);
  const largo = contenido.length + 3;
  return [
    // Modelo 2
    GS,
    0x28,
    0x6b,
    0x04,
    0x00,
    0x31,
    0x41,
    0x32,
    0x00,
    // Tamaño del módulo (1-16)
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x43,
    0x05,
    // Corrección de errores M
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    0x31,
    // Guardar los datos
    GS,
    0x28,
    0x6b,
    largo & 0xff,
    (largo >> 8) & 0xff,
    0x31,
    0x50,
    0x30,
    ...contenido,
    // Imprimir
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x51,
    0x30,
  ];
}

export type OpcionesEscpos = {
  /** Caracteres por línea con letra normal (48 en 80 mm, 32 en 58 mm). */
  columnas: number;
  /** Tabla de caracteres de la impresora para CP858 (19 en Epson; algunas usan 16 o 17). */
  tablaCaracteres?: number;
};

export function aEscpos(documento: Bloque[], opciones: OpcionesEscpos): Uint8Array {
  const { columnas } = opciones;
  const b: number[] = [ESC, 0x40, ESC, 0x74, opciones.tablaCaracteres ?? 19];
  const linea = (texto: string) => b.push(...codificarTexto(texto), 0x0a);

  for (const bloque of documento) {
    switch (bloque.tipo) {
      case "texto": {
        const ancho = bloque.grande ? Math.floor(columnas / 2) : columnas;
        b.push(ESC, 0x61, ALINEACION[bloque.alinear ?? "izquierda"]);
        if (bloque.negrita) b.push(ESC, 0x45, 1);
        if (bloque.grande) b.push(GS, 0x21, 0x11);
        for (const l of partirTexto(bloque.texto, ancho)) linea(l);
        if (bloque.grande) b.push(GS, 0x21, 0x00);
        if (bloque.negrita) b.push(ESC, 0x45, 0);
        b.push(ESC, 0x61, 0);
        break;
      }
      case "par":
        if (bloque.negrita) b.push(ESC, 0x45, 1);
        for (const l of lineaPar(bloque.izquierda, bloque.derecha, columnas)) linea(l);
        if (bloque.negrita) b.push(ESC, 0x45, 0);
        break;
      case "separador":
        linea((bloque.caracter ?? "-").repeat(columnas));
        break;
      case "espacio":
        b.push(ESC, 0x64, bloque.lineas ?? 1);
        break;
      case "qr":
        b.push(ESC, 0x61, 1, ...qr(bloque.datos), 0x0a, ESC, 0x61, 0);
        break;
      case "corte":
        // Avanza el papel hasta la cuchilla y hace un corte parcial.
        b.push(GS, 0x56, 0x42, 0x00);
        break;
      case "cajon":
        // Pulso al conector del cajón portamonedas (pin 2).
        b.push(ESC, 0x70, 0x00, 0x19, 0xfa);
        break;
    }
  }
  return Uint8Array.from(b);
}
