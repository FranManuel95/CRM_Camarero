import { describe, expect, it } from "vitest";
import { aCsv, importeCsv } from "@/lib/csv";

describe("CSV", () => {
  it("usa punto y coma, coma decimal y escapa comillas", () => {
    expect(
      aCsv([
        ["Concepto", "Importe"],
        ['Vino "Rioja"; tinto', importeCsv(1250)],
      ]),
    ).toBe('﻿Concepto;Importe\r\n"Vino ""Rioja""; tinto";12,5');
  });
});
