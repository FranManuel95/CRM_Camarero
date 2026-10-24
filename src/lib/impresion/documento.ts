/**
 * Un documento de impresión es una lista de bloques sencillos. De la misma lista salen tres
 * cosas: los bytes ESC/POS para la impresora térmica (escpos.ts), el texto de la vista previa
 * (aTexto) y la página para imprimir desde el navegador.
 */
export type Alineacion = "izquierda" | "centro" | "derecha";

export type Bloque =
  | {
      tipo: "texto";
      texto: string;
      alinear?: Alineacion;
      negrita?: boolean;
      /** Doble de alto y de ancho: para el número de mesa en las comandas. */
      grande?: boolean;
    }
  /** Texto a la izquierda y a la derecha en la misma línea (concepto … importe). */
  | { tipo: "par"; izquierda: string; derecha: string; negrita?: boolean }
  | { tipo: "separador"; caracter?: string }
  | { tipo: "espacio"; lineas?: number }
  | { tipo: "qr"; datos: string }
  | { tipo: "corte" }
  | { tipo: "cajon" };

/** Parte un texto en líneas de como mucho `ancho` caracteres, sin cortar palabras si se puede. */
export function partirTexto(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let resto = palabra;
      while (resto.length > ancho) {
        if (actual) {
          lineas.push(actual);
          actual = "";
        }
        lineas.push(resto.slice(0, ancho));
        resto = resto.slice(ancho);
      }
      if (!actual) actual = resto;
      else if (actual.length + 1 + resto.length <= ancho) actual += " " + resto;
      else {
        lineas.push(actual);
        actual = resto;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

export function alinear(texto: string, ancho: number, como: Alineacion = "izquierda"): string {
  if (texto.length >= ancho) return texto;
  const hueco = ancho - texto.length;
  if (como === "derecha") return " ".repeat(hueco) + texto;
  if (como === "centro") return " ".repeat(Math.floor(hueco / 2)) + texto;
  return texto;
}

/** «Caña ……… 2,00 €»: el concepto se parte si no cabe y el importe va en la última línea. */
export function lineaPar(izquierda: string, derecha: string, ancho: number): string[] {
  const hueco = ancho - derecha.length - 1;
  if (hueco < 4) return [...partirTexto(izquierda, ancho), alinear(derecha, ancho, "derecha")];
  const partes = partirTexto(izquierda, hueco);
  const ultima = partes.pop() ?? "";
  return [...partes, ultima + " ".repeat(ancho - ultima.length - derecha.length) + derecha];
}

/** Texto plano tal y como sale en el papel (sin negritas). Para la vista previa y las pruebas. */
export function aTexto(documento: Bloque[], ancho: number): string {
  const salida: string[] = [];
  for (const b of documento) {
    switch (b.tipo) {
      case "texto": {
        const anchoReal = b.grande ? Math.floor(ancho / 2) : ancho;
        for (const l of partirTexto(b.texto, anchoReal))
          salida.push(alinear(l, anchoReal, b.alinear));
        break;
      }
      case "par":
        salida.push(...lineaPar(b.izquierda, b.derecha, ancho));
        break;
      case "separador":
        salida.push((b.caracter ?? "-").repeat(ancho));
        break;
      case "espacio":
        for (let i = 0; i < (b.lineas ?? 1); i++) salida.push("");
        break;
      case "qr":
        salida.push(alinear("[QR]", ancho, "centro"));
        break;
      case "corte":
        salida.push("✂" + "-".repeat(ancho - 1));
        break;
      case "cajon":
        break;
    }
  }
  return salida.join("\n");
}
