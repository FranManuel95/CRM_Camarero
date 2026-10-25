import "server-only";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import type { Estado, TrabajoImpresion } from "../dominio/tipos";
import { aEscpos } from "../impresion/escpos";
import { type Almacen, contexto, LOCAL_ARCHIVO, marcarTrabajo } from "./almacen";
import { enviarAImpresora } from "./impresora-red";

/**
 * El estado en un archivo JSON en el ordenador del bar. Es un solo proceso: las acciones se
 * aplican de una en una y nunca se pisan.
 */
const carpeta = () => process.env.DATOS_DIR ?? path.join(process.cwd(), "datos");

/** Secreto de las sesiones, guardado junto a los datos (se crea la primera vez). */
almacenArchivo.secreto = (): string => {
  mkdirSync(carpeta(), { recursive: true });
  const ruta = path.join(carpeta(), "secreto");
  if (!existsSync(ruta)) writeFileSync(ruta, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(ruta, "utf8").trim();
};

export function almacenArchivo(): Almacen {
  const dir = carpeta();
  const archivo = path.join(dir, "estado.json");
  mkdirSync(dir, { recursive: true });

  let estado: Estado;
  if (existsSync(archivo)) estado = migrar(JSON.parse(readFileSync(archivo, "utf8")) as Estado);
  else estado = estadoDeEjemplo(contexto(), { conHistorial: process.env.DEMO !== "false" });

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
      return marcarTrabajo(LOCAL_ARCHIVO, trabajo.id, {
        estado: "error",
        error: "La impresora ya no existe.",
      });
    try {
      await enviarAImpresora(
        impresora.ip,
        impresora.puerto,
        aEscpos(trabajo.documento, { columnas: impresora.columnas }),
      );
      await marcarTrabajo(LOCAL_ARCHIVO, trabajo.id, { estado: "impreso" });
    } catch (e) {
      await marcarTrabajo(LOCAL_ARCHIVO, trabajo.id, {
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
