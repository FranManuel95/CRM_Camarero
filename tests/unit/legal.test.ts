import { describe, expect, it } from "vitest";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import type { Funcion } from "@/lib/dominio/funciones";
import { legalDelBar, legalDePlataforma, prestadorDe } from "@/lib/dominio/legal";
import { accionPersonal } from "@/lib/dominio/acciones";
import { reducirPersonal } from "@/lib/dominio/reducir";
import { contexto } from "./ayuda";

const todo: (f: Funcion) => boolean = () => true;
const texto = (t: ReturnType<typeof legalDelBar>) =>
  t.secciones.flatMap((s) => s.parrafos).join("\n");

describe("textos legales", () => {
  const { ajustes } = estadoDeEjemplo(contexto());

  it("el del bar lleva sus datos y solo habla de lo que tiene encendido", () => {
    const completo = legalDelBar(ajustes, todo, { nombre: "Prestador", nif: "X0000000T" }, true);
    expect(completo.faltan).toEqual([]);
    const t = texto(completo);
    expect(t).toContain("B00000000");
    expect(t).toContain("hola@laesquina.example");
    expect(t).toContain("Reservas:");
    expect(t).toContain("Club de clientes:");
    expect(t).toContain("Ticket por correo:");
    expect(t).toContain("Prestador (NIF X0000000T)");

    const sinNada = texto(legalDelBar(ajustes, () => false, null, false));
    expect(sinNada).not.toContain("Reservas:");
    expect(sinNada).not.toContain("Club de clientes:");
    expect(sinNada).not.toContain("Ticket por correo:");
    expect(sinNada).toContain("carta QR: no se piden datos personales");
  });

  it("dice qué falta para que esté completo", () => {
    const t = legalDelBar({ ...ajustes, nif: "", correoContacto: "" }, todo, null, false);
    expect(t.faltan).toEqual(["el NIF", "un correo de contacto"]);
  });

  it("el prestador sale de LEGAL_* o, si no, del productor de VERI*FACTU", () => {
    expect(prestadorDe({})).toBeNull();
    expect(prestadorDe({ VERIFACTU_PRODUCTOR_NOMBRE: "A", VERIFACTU_PRODUCTOR_NIF: "1" })).toEqual({
      nombre: "A",
      nif: "1",
      correo: undefined,
    });
    const p = prestadorDe({
      LEGAL_TITULAR_NOMBRE: "B",
      LEGAL_TITULAR_NIF: "2",
      LEGAL_TITULAR_CORREO: "c@d.example",
    });
    expect(legalDePlataforma(p, "Comanda").faltan).toEqual([]);
    expect(legalDePlataforma(null, "Comanda").faltan.length).toBe(2);
  });

  it("el correo de contacto se guarda con los ajustes y se valida", () => {
    const ctx = contexto();
    const estado = estadoDeEjemplo(ctx);
    const encargado = estado.empleados.find((e) => e.rol === "encargado")!;
    const { correoContacto: _c, funciones: _f, resumenDiario: _r, ...resto } = estado.ajustes;
    void _c;
    void _f;
    void _r;
    const accion = (correo: string) =>
      accionPersonal.safeParse({
        tipo: "guardar_ajustes",
        ajustes: { ...resto, correoContacto: correo },
      });
    expect(accion("no-es-un-correo").success).toBe(false);
    const valida = accion("nuevo@bar.example");
    if (!valida.success) throw valida.error;
    const r = reducirPersonal(estado, valida.data, encargado, ctx);
    expect(r.estado.ajustes.correoContacto).toBe("nuevo@bar.example");
  });
});
