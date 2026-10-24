/**
 * CSV para abrir en Excel en español: separado por punto y coma, con coma decimal y con BOM
 * para que las tildes salgan bien. Es lo que suele pedir la gestoría.
 */
export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    if (v === null) return "";
    const texto = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}

/** Céntimos → número con dos decimales para el CSV. */
export const importeCsv = (centimos: number) => Number((centimos / 100).toFixed(2));
