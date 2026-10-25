import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256 } from "@/lib/sha256";

describe("sha256 sin node:crypto", () => {
  it("da lo mismo que node:crypto con textos de todo tipo", () => {
    const textos = [
      "",
      "abc",
      "comanda-pin:1234",
      "IDEmisorFactura=B00000000&NumSerieFactura=T2026-000001&ImporteTotal=12.50",
      "Ñandú, cañas y croquetas: «¡olé!» €",
      "x".repeat(55),
      "y".repeat(56),
      "z".repeat(64),
      "largo ".repeat(500),
    ];
    for (const t of textos)
      expect(sha256(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
  });
});
