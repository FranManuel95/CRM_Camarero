import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaValida, pagoDelAviso } from "@/lib/servidor/stripe";

const secreto = "whsec_prueba";
const ahora = 1_800_000_000_000;
const firmar = (cuerpo: string, t = ahora / 1000) =>
  `t=${t},v1=${createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex")}`;

describe("avisos de Stripe", () => {
  const cuerpo = JSON.stringify({ type: "checkout.session.completed" });

  it("solo valen con la firma del webhook y recientes", () => {
    expect(firmaValida(cuerpo, firmar(cuerpo), secreto, ahora)).toBe(true);
    expect(firmaValida(cuerpo + " ", firmar(cuerpo), secreto, ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo), "otro", ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, ahora / 1000 - 600), secreto, ahora)).toBe(false);
    expect(firmaValida(cuerpo, null, secreto, ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo), "", ahora)).toBe(false);
  });

  it("del aviso sale el pago, con lo cobrado de verdad", () => {
    const sesion = (extra: object) => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          amount_total: 1250,
          metadata: { local: "la-esquina", cuentaId: "c1", importe: "1250" },
          ...extra,
        },
      },
    });
    expect(pagoDelAviso(sesion({}))).toEqual({
      referencia: "cs_1",
      local: "la-esquina",
      cuentaId: "c1",
      importe: 1250,
    });
    expect(pagoDelAviso(sesion({ payment_status: "unpaid" }))).toBeNull();
    expect(pagoDelAviso(sesion({ metadata: {} }))).toBeNull();
    expect(pagoDelAviso({ type: "payment_intent.created" })).toBeNull();
  });
});
