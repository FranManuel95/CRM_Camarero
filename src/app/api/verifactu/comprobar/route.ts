import { declaracionResponsable, productorDe } from "@/lib/dominio/declaracion";
import { activa } from "@/lib/dominio/funciones";
import { nifValido, normalizarNif } from "@/lib/dominio/nif";
import { enLaNube, leerEstado } from "@/lib/servidor/almacen";
import { comprobarCertificado } from "@/lib/servidor/certificado";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { direccion } from "@/lib/servidor/verifactu";

export const dynamic = "force-dynamic";

/** «ok»: listo; «aviso»: se puede seguir, pero mira esto; «falta»: hay que arreglarlo antes. */
export type Paso = { titulo: string; estado: "ok" | "aviso" | "falta"; detalle: string };

const DIA = 86_400_000;

/**
 * Lo que hace falta para encender VERI*FACTU, comprobado de verdad: datos del bar, certificado
 * (se abre y se conecta con la AEAT, sin mandar nada) y datos del fabricante.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede ver esto." }, 403);
  try {
    const { ajustes } = await leerEstado(sesion.local);
    const produccion = process.env.VERIFACTU_ENTORNO === "produccion";
    const pasos: Paso[] = [];

    const faltanBar = [
      !ajustes.razonSocial && "la razón social",
      !ajustes.nif && "el NIF",
      ajustes.nif && !nifValido(ajustes.nif) && "un NIF válido (el que hay no cuadra)",
      !ajustes.direccion && "la dirección",
    ].filter(Boolean);
    pasos.push({
      titulo: "Datos fiscales del bar",
      estado: faltanBar.length ? "falta" : "ok",
      detalle: faltanBar.length
        ? `Falta ${faltanBar.join(", ")} en Gestión → Ajustes.`
        : `${ajustes.razonSocial} · ${normalizarNif(ajustes.nif)}`,
    });

    const pfx = process.env.VERIFACTU_CERTIFICADO;
    if (!pfx) {
      pasos.push({
        titulo: "Certificado electrónico del bar",
        estado: "falta",
        detalle:
          "Aún no está en el servidor. Pide al bar su certificado (.p12 o .pfx) y su contraseña.",
      });
    } else {
      const c = await comprobarCertificado(pfx, process.env.VERIFACTU_CLAVE ?? "", direccion());
      if (!c.abre)
        pasos.push({
          titulo: "Certificado electrónico del bar",
          estado: "falta",
          detalle: c.error!,
        });
      else {
        const dias = c.caduca ? Math.floor((Date.parse(c.caduca) - Date.now()) / DIA) : null;
        const fecha = c.caduca ? new Date(c.caduca).toLocaleDateString("es-ES") : "?";
        pasos.push({
          titulo: "Certificado electrónico del bar",
          estado: dias !== null && dias < 0 ? "falta" : dias !== null && dias < 30 ? "aviso" : "ok",
          detalle:
            `${c.titular ?? "Sin nombre"}${c.nif ? ` (${c.nif})` : ""}. ` +
            (dias !== null && dias < 0
              ? `Caducó el ${fecha}.`
              : `Caduca el ${fecha}${dias !== null && dias < 30 ? `: quedan ${dias} días, renuévalo` : ""}.`),
        });
        const delBar = c.nif && ajustes.nif && c.nif === normalizarNif(ajustes.nif);
        pasos.push({
          titulo: "El certificado es del bar",
          estado: delBar ? "ok" : "aviso",
          detalle: delBar
            ? "El NIF del certificado es el del bar."
            : "El NIF del certificado no es el del bar. Solo vale si su titular puede presentar en nombre del bar (apoderamiento o colaboración social).",
        });
        pasos.push({
          titulo: `Conexión con Hacienda (${produccion ? "producción" : "pruebas"})`,
          estado: c.conecta ? "ok" : "falta",
          detalle: c.conecta
            ? "La AEAT acepta la conexión con este certificado."
            : (c.error ?? "No conecta."),
        });
      }
    }

    const d = declaracionResponsable(productorDe(process.env), enLaNube());
    pasos.push({
      titulo: "Datos del fabricante y declaración responsable",
      estado: d.faltan.length ? "falta" : "ok",
      detalle: d.faltan.length
        ? `Faltan en Vercel: ${d.faltan.join(", ")}.`
        : "Completa y firmada (/declaracion-responsable).",
    });
    pasos.push({
      titulo: "Entorno",
      estado: produccion ? "ok" : "aviso",
      detalle: produccion
        ? "Producción: lo que se manda cuenta para Hacienda."
        : "Pruebas: lo que se manda no cuenta. Cuando todo vaya bien, cambia VERIFACTU_ENTORNO a «produccion».",
    });

    return json({
      encendida: activa(ajustes, "verifactu"),
      listo: pasos.every((p) => p.estado !== "falta"),
      pasos,
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
