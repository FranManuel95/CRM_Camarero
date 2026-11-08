import "server-only";
import { connect } from "node:tls";
import { normalizarNif } from "../dominio/nif";

export type ComprobacionCertificado = {
  /** El certificado se ha podido abrir con su contraseña. */
  abre: boolean;
  titular?: string;
  nif?: string;
  caduca?: string;
  /** La AEAT ha aceptado la conexión con este certificado. */
  conecta: boolean;
  error?: string;
};

type Sujeto = Record<string, string | string[] | undefined>;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * El NIF del titular según los campos de los certificados españoles: el de la entidad
 * («VATES-B12345678») si es de representante o de sello, si no el de la persona
 * («IDCES-12345678Z» o el NIF solo), y como último recurso el que aparezca en el nombre.
 */
export function nifDelSujeto(sujeto: Sujeto): string | undefined {
  const entidad = uno(sujeto.organizationIdentifier) ?? uno(sujeto["2.5.4.97"]);
  if (entidad?.startsWith("VATES-")) return normalizarNif(entidad.slice(6));
  const serie = uno(sujeto.serialNumber);
  if (serie) return normalizarNif(serie.replace(/^IDCES-/, ""));
  const enNombre = /\b([XYZ]?\d{7,8}[A-Z]|[A-HJNP-SUVW]\d{7}[0-9A-J])\b/.exec(uno(sujeto.CN) ?? "");
  return enNombre?.[1];
}

/**
 * Abre una conexión con la AEAT presentando el certificado, como al mandar los registros, y
 * cuenta qué certificado es (titular, NIF, caducidad). No manda nada.
 */
export function comprobarCertificado(
  pfxBase64: string,
  clave: string,
  url: string,
  opciones: { ca?: string | Buffer; segundos?: number } = {},
): Promise<ComprobacionCertificado> {
  const destino = new URL(url);
  return new Promise((resolver) => {
    let resuelto = false;
    const fin = (r: ComprobacionCertificado) => {
      if (resuelto) return;
      resuelto = true;
      resolver(r);
    };
    let socket: ReturnType<typeof connect>;
    try {
      socket = connect({
        host: destino.hostname,
        port: Number(destino.port || 443),
        servername: destino.hostname,
        pfx: Buffer.from(pfxBase64, "base64"),
        passphrase: clave,
        ...(opciones.ca ? { ca: opciones.ca } : {}),
      });
    } catch (e) {
      const texto = String((e as Error).message);
      return fin({
        abre: false,
        conecta: false,
        error: /mac verify|bad decrypt|password/i.test(texto)
          ? "La contraseña del certificado no es correcta."
          : "El certificado no se puede abrir (¿es un .p12 o .pfx en base64?).",
      });
    }
    const datosLocales = () => {
      const c = socket.getCertificate();
      if (!c || !("subject" in c)) return {};
      const sujeto = c.subject as unknown as Sujeto;
      return {
        titular: uno(sujeto.CN) ?? uno(sujeto.O),
        nif: nifDelSujeto(sujeto),
        caduca: new Date(c.valid_to).toISOString(),
      };
    };
    socket.setTimeout((opciones.segundos ?? 15) * 1000, () => {
      fin({ abre: true, conecta: false, ...datosLocales(), error: "La AEAT no contesta." });
      socket.destroy();
    });
    socket.once("secureConnect", () => {
      fin({ abre: true, conecta: true, ...datosLocales() });
      socket.end();
    });
    socket.once("error", (e) => {
      fin({
        abre: true,
        conecta: false,
        ...datosLocales(),
        error: `No se ha podido conectar con la AEAT: ${e.message}`,
      });
    });
  });
}
