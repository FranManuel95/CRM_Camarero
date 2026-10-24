import "server-only";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import type { Estado, TrabajoImpresion } from "../dominio/tipos";
import { aEscpos } from "../impresion/escpos";
import { type Almacen, contexto, marcarTrabajo } from "./almacen";
import { enviarAImpresora } from "./impresora-red";

/**
 * El estado en un archivo JSON en el ordenador del bar. Es un solo proceso: las acciones se
 * aplican de una en una y nunca se pisan.
 */
export function almacenArchivo(): Almacen {
  const carpeta = process.env.DATOS_DIR ?? path.join(process.cwd(), "datos");
  const archivo = path.join(carpeta, "estado.json");
  mkdirSync(carpeta, { recursive: true });

  let estado: Estado;
  if (existsSync(archivo)) estado = migrar(JSON.parse(readFileSync(archivo, "utf8")) as Estado);
  else estado = estadoDeEjemplo(contexto(), { conHistorial: process.env.DEMO !== "false" });

  const rutaSecreto = path.join(carpeta, "secreto");
  if (!existsSync(rutaSecreto))
    writeFileSync(rutaSecreto, randomBytes(32).toString("hex"), { mode: 0o600 });
  const secreto = readFileSync(rutaSecreto, "utf8").trim();
  const eventos = new EventEmitter();
  eventos.setMaxListeners(200);

  /** Escribe en un temporal y lo renombra: si se va la luz a mitad, el anterior sigue entero. */
  function guardar(nuevo: Estado) {
    const temporal = `${archivo}.tmp`;
    writeFileSync(temporal, JSON.stringify(nuevo));
    renameSync(temporal, archivo);
    estado = nuevo;
    eventos.emit("cambio");
  }
  guardar(estado);

  async function imprimir(trabajo: TrabajoImpresion) {
    const impresora = estado.impresoras.find((i) => i.id === trabajo.impresoraId);
    if (!impresora)
      return marcarTrabajo(trabajo.id, { estado: "error", error: "La impresora ya no existe." });
    try {
      await enviarAImpresora(
        impresora.ip,
        impresora.puerto,
        aEscpos(trabajo.documento, { columnas: impresora.columnas }),
      );
      await marcarTrabajo(trabajo.id, { estado: "impreso" });
    } catch (e) {
      await marcarTrabajo(trabajo.id, {
        estado: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    modo: "archivo",
    leer: async () => estado,
    async cambiar(aplicar) {
      const r = aplicar(estado);
      guardar(r.estado);
      return r;
    },
    secreto: () => secreto,
    suscribirse(alCambiar) {
      eventos.on("cambio", alCambiar);
      return () => eventos.off("cambio", alCambiar);
    },
    async reiniciar() {
      guardar(estadoDeEjemplo(contexto(), { conHistorial: true }));
    },
    imprimirEnRed: (t) => void imprimir(t),
  };
}
