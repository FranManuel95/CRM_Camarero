import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerRespuesta, sobreSoap } from "@/lib/aeat/xml";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { calcularHuella, verificarCadena } from "@/lib/dominio/huella";
import { reducirPersonal } from "@/lib/dominio/reducir";
import type { Estado } from "@/lib/dominio/tipos";
import { apuntarRespuesta, porEnviar } from "@/lib/dominio/verifactu";
import { aTexto } from "@/lib/impresion/documento";
import { plantillaTicket } from "@/lib/impresion/plantillas";
import { fechaAeat, fechaHoraConHuso } from "@/lib/fechas";
import { contexto } from "./ayuda";

const ctx = contexto();

describe("huella VERI*FACTU", () => {
  it("da lo mismo que el ejemplo oficial de la AEAT", () => {
    // Ejemplo de la AEAT (con TipoFactura F1; los tickets son F2, pero la cuenta es la misma).
    const primera = calcularHuella({
      nif: "89890001K",
      numero: "12345678/G33",
      fechaExpedicion: "01-01-2024",
      tipoFactura: "F1",
      cuotaTotal: 1235,
      importeTotal: 12345,
      huellaAnterior: "",
      generadoEn: "2024-01-01T19:20:30+01:00",
    });
    expect(primera).toBe("3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60");
  });

  it("fechas en hora de Madrid, con su huso", () => {
    expect(fechaHoraConHuso("2026-10-24T19:05:09.123Z")).toBe("2026-10-24T21:05:09+02:00");
    expect(fechaHoraConHuso("2026-12-31T23:30:00.000Z")).toBe("2027-01-01T00:30:00+01:00");
    expect(fechaAeat("2026-12-31T23:30:00.000Z")).toBe("01-01-2027");
  });
});

describe("VERI*FACTU en los tickets", () => {
  function conVerifactu() {
    let estado: Estado = estadoDeEjemplo(ctx);
    const ana = estado.empleados.find((e) => e.rol === "encargado")!;
    const hacer = (accion: AccionPersonal) => {
      estado = reducirPersonal(estado, accion, ana, ctx).estado;
    };
    hacer({ tipo: "cambiar_funcion", funcion: "verifactu", activa: true });
    hacer({ tipo: "abrir_caja", fondoInicial: 0 });
    const cobrarCaña = () => {
      hacer({
        tipo: "venta_rapida",
        lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
        pagos: [{ metodo: "tarjeta", importe: 200 }],
      });
      return estado.tickets.at(-1)!;
    };
    return {
      get estado() {
        return estado;
      },
      set estado(e: Estado) {
        estado = e;
      },
      hacer,
      cobrarCaña,
    };
  }

  it("cada ticket lleva el QR de cotejo, la leyenda y su registro por mandar", () => {
    const t = conVerifactu();
    const primero = t.cobrarCaña();
    expect(t.estado.verifactu!.registros[0]!.anterior).toBeNull();
    const ticket = t.cobrarCaña();
    expect(ticket.tipoFactura).toBe("F2");
    expect(ticket.generadoEn).toBe("2026-10-24T21:00:00+02:00");
    expect(ticket.urlQr).toBe(
      `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B00000000&numserie=${ticket.numero}&fecha=24-10-2026&importe=2.00`,
    );
    const registro = t.estado.verifactu!.registros.at(-1)!;
    expect(registro).toMatchObject({
      ticketId: ticket.id,
      estado: "pendiente",
      importeTotal: 200,
      anterior: { numero: primero.numero, huella: primero.huella },
    });
    const papel = aTexto(
      plantillaTicket({ ajustes: t.estado.ajustes, ticket, urlQr: ticket.urlQr }),
      48,
    );
    expect(papel).toContain("QR tributario:");
    expect(papel).toContain("VERI*FACTU");
  });

  it("la rectificativa es R5 y dice qué ticket rectifica", () => {
    const t = conVerifactu();
    const ticket = t.cobrarCaña();
    t.hacer({ tipo: "rectificar_ticket", ticketId: ticket.id });
    const r = t.estado.verifactu!.registros.at(-1)!;
    expect(r).toMatchObject({
      tipoFactura: "R5",
      importeTotal: -200,
      rectifica: { numero: ticket.numero, fechaExpedicion: "24-10-2026" },
      anterior: { numero: ticket.numero, huella: ticket.huella },
    });
    expect(verificarCadena(t.estado.tickets)).toBeNull();
  });

  it("sin VERI*FACTU no hay QR ni registros, pero la huella es la misma de siempre", () => {
    let estado = estadoDeEjemplo(ctx);
    const ana = estado.empleados.find((e) => e.rol === "encargado")!;
    estado = reducirPersonal(estado, { tipo: "abrir_caja", fondoInicial: 0 }, ana, ctx).estado;
    estado = reducirPersonal(
      estado,
      {
        tipo: "venta_rapida",
        lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
        pagos: [{ metodo: "tarjeta", importe: 200 }],
      },
      ana,
      ctx,
    ).estado;
    const ticket = estado.tickets.at(-1)!;
    expect(ticket.urlQr).toBeUndefined();
    expect(estado.verifactu).toBeUndefined();
    expect(ticket.huella).toMatch(/^[0-9A-F]{64}$/);
  });

  it("el XML lleva la cadena y lo que contesta la AEAT se apunta en cada registro", () => {
    const t = conVerifactu();
    const primero = t.cobrarCaña();
    const segundo = t.cobrarCaña();
    const registros = porEnviar(t.estado, ctx.ahora);
    expect(registros.map((r) => r.numero)).toEqual([primero.numero, segundo.numero]);
    const xml = sobreSoap(
      registros,
      { nombre: "Bar La Esquina, S.L. (ficticio)", nif: "B00000000" },
      {
        nombreFabricante: "Fabricante Ficticio, S.L.",
        nifFabricante: "B00000001",
        numeroInstalacion: "la-esquina",
        version: "1.0",
        multiplesBares: true,
      },
    );
    expect(xml).toContain("<sum1:TipoFactura>F2</sum1:TipoFactura>");
    expect(xml).toContain(`<sum1:Huella>${primero.huella}</sum1:Huella></sum1:RegistroAnterior>`);
    expect(xml).toContain(
      "<sum1:NombreRazonEmisor>Bar La Esquina, S.L. (ficticio)</sum1:NombreRazonEmisor>",
    );
    if (process.env.XML_SALIDA) writeFileSync(process.env.XML_SALIDA, xml);

    const respuesta =
      leerRespuesta(`<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="x" xmlns:tik="y">
      <tikR:CSV>A-ABC123</tikR:CSV><tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>ParcialmenteCorrecto</tikR:EstadoEnvio>
      <tikR:RespuestaLinea><tikR:IDFactura><tik:IDEmisorFactura>B00000000</tik:IDEmisorFactura><tik:NumSerieFactura>${primero.numero}</tik:NumSerieFactura></tikR:IDFactura><tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro></tikR:RespuestaLinea>
      <tikR:RespuestaLinea><tikR:IDFactura><tik:IDEmisorFactura>B00000000</tik:IDEmisorFactura><tik:NumSerieFactura>${segundo.numero}</tik:NumSerieFactura></tikR:IDFactura><tikR:EstadoRegistro>Incorrecto</tikR:EstadoRegistro><tikR:CodigoErrorRegistro>1100</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>Valor no válido</tikR:DescripcionErrorRegistro></tikR:RespuestaLinea>
      </tikR:RespuestaRegFactuSistemaFacturacion></env:Body></env:Envelope>`);
    t.estado = apuntarRespuesta(
      t.estado,
      registros.map((r) => r.ticketId),
      respuesta,
      ctx.ahora,
    );
    const [a, b] = t.estado.verifactu!.registros.slice(-2);
    expect(a).toMatchObject({ estado: "correcto", csv: "A-ABC123" });
    expect(b).toMatchObject({ estado: "incorrecto", error: "1100 Valor no válido" });
    // La AEAT pide esperar 60 s antes de mandar otra vez.
    expect(porEnviar(t.estado, ctx.ahora)).toEqual([]);
    expect(() =>
      leerRespuesta("<env:Fault><faultstring>Certificado no válido</faultstring></env:Fault>"),
    ).toThrow("Certificado no válido");
  });
});
