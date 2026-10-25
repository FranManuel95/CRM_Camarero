import "server-only";
import { request } from "node:https";
import { ErrorAeat, leerRespuesta, sobreSoap } from "../aeat/xml";
import { disponible } from "../dominio/funciones";
import { apuntarFallo, apuntarRespuesta, porEnviar, reservarEnvio } from "../dominio/verifactu";
import type { RegistroAeat } from "../dominio/tipos";
import { almacen, enLaNube } from "./almacen";
import { servicios } from "./servicios";

/**
 * Envío de los registros de VERI*FACTU a la AEAT por su servicio web (SOAP), con el certificado
 * electrónico del bar. Variables:
 * - VERIFACTU_CERTIFICADO: el certificado .p12/.pfx en base64. VERIFACTU_CLAVE: su contraseña.
 * - VERIFACTU_SELLO=1 si es un certificado de sello (va a otra dirección de la AEAT).
 * - VERIFACTU_ENTORNO=produccion para mandar de verdad (si no, al entorno de pruebas).
 * - VERIFACTU_PRODUCTOR_NOMBRE y VERIFACTU_PRODUCTOR_NIF: quien fabrica y responde del programa.
 */

const URL_AEAT = {
  pruebas: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  pruebasSello: "https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  produccion:
    "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  produccionSello:
    "https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
};

function direccion() {
  const produccion = process.env.VERIFACTU_ENTORNO === "produccion";
  const sello = process.env.VERIFACTU_SELLO === "1";
  return URL_AEAT[
    `${produccion ? "produccion" : "pruebas"}${sello ? "Sello" : ""}` as keyof typeof URL_AEAT
  ];
}

/** Manda el sobre con el certificado (TLS mutuo) y devuelve el XML de la respuesta. */
function mandar(xml: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const peticion = request(
      direccion(),
      {
        method: "POST",
        pfx: Buffer.from(process.env.VERIFACTU_CERTIFICADO ?? "", "base64"),
        passphrase: process.env.VERIFACTU_CLAVE ?? "",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
        timeout: 30_000,
      },
      (respuesta) => {
        const trozos: Buffer[] = [];
        respuesta.on("data", (t: Buffer) => trozos.push(t));
        respuesta.on("end", () => resolver(Buffer.concat(trozos).toString("utf8")));
      },
    );
    peticion.on("timeout", () => peticion.destroy(new Error("La AEAT no contesta.")));
    peticion.on("error", rechazar);
    peticion.end(xml);
  });
}

/**
 * Manda lo pendiente de un bar, si VERI*FACTU está encendido y la AEAT no ha pedido esperar.
 * Nunca lanza: si algo falla, queda apuntado y se reintenta en el siguiente envío.
 */
export async function enviarVerifactu(local: string): Promise<void> {
  const a = almacen(local);
  let registros: RegistroAeat[] = [];
  let obligado = { nombre: "", nif: "" };
  const ahora = new Date().toISOString();
  try {
    await a.cambiar((estado) => {
      registros = disponible(estado.ajustes, servicios(), "verifactu")
        ? porEnviar(estado, ahora)
        : [];
      obligado = {
        nombre: estado.ajustes.razonSocial || estado.ajustes.nombreLocal,
        nif: estado.ajustes.nif.trim().toUpperCase(),
      };
      return { estado: registros.length ? reservarEnvio(estado, ahora) : estado, trabajos: [] };
    });
  } catch (e) {
    console.error("VERI*FACTU:", e);
    return;
  }
  if (!registros.length) return;
  const enviados = registros.map((r) => r.ticketId);
  try {
    const xml = sobreSoap(registros, obligado, {
      nombreFabricante: process.env.VERIFACTU_PRODUCTOR_NOMBRE ?? "",
      nifFabricante: process.env.VERIFACTU_PRODUCTOR_NIF ?? "",
      numeroInstalacion: local,
      version: "1.0",
      multiplesBares: enLaNube(),
    });
    const respuesta = leerRespuesta(await mandar(xml));
    const hora = new Date().toISOString();
    await a.cambiar((estado) => ({
      estado: apuntarRespuesta(estado, enviados, respuesta, hora),
      trabajos: [],
    }));
  } catch (e) {
    const motivo =
      e instanceof ErrorAeat
        ? `La AEAT dice: ${e.message}`
        : "No se ha podido conectar con la AEAT. Se reintenta en el próximo envío.";
    console.error("VERI*FACTU:", e);
    await a
      .cambiar((estado) => ({ estado: apuntarFallo(estado, motivo), trabajos: [] }))
      .catch(() => {});
  }
}
