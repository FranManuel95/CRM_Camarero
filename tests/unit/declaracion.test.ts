import { describe, expect, it } from "vitest";
import { declaracionEnTexto, declaracionResponsable, productorDe } from "@/lib/dominio/declaracion";

describe("declaración responsable", () => {
  it("lleva los datos del art. 15.1 en orden, con su título, y dice lo que falta", () => {
    const vacia = declaracionResponsable(productorDe({}), true);
    expect(vacia.titulo).toBe("DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN");
    expect(vacia.datos.map((d) => d.letra).join("")).toBe("abcdefghijkl");
    expect(vacia.faltan).toContain("VERIFACTU_PRODUCTOR_DIRECCION");

    const firmada = declaracionResponsable(
      productorDe({
        VERIFACTU_PRODUCTOR_NOMBRE: "Fabricante de Prueba",
        VERIFACTU_PRODUCTOR_NIF: "X0000000T",
        VERIFACTU_PRODUCTOR_DIRECCION: "Calle Inventada, 1, 00000 Ciudad, España",
        DECLARACION_FECHA: "01-12-2026",
        DECLARACION_LUGAR: "Ciudad, España",
      }),
      true,
    );
    expect(firmada.faltan).toEqual([]);
    const texto = declaracionEnTexto(firmada);
    expect(texto).toContain("c) Identificador completo de la versión concreta");
    expect(texto).toContain("e) Indicación de si el sistema informático se ha producido");
    expect(texto).toContain("artículo 29.2.j) de la Ley 58/2003");
    expect(texto).toContain(
      "l) Fecha y lugar en los que se suscribe la declaración responsable: 01-12-2026, Ciudad, España",
    );
    expect(texto).not.toContain("[pendiente]");
  });
});
