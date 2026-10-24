import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AccionCliente, AccionPersonal } from "../dominio/acciones";
import { estadoDeEjemplo, VERSION_ESTADO } from "../dominio/demo";
import { type Contexto, type Resultado, reducirCliente, reducirPersonal } from "../dominio/reducir";
import type { Empleado, Estado, TrabajoImpresion } from "../dominio/tipos";
import { aEscpos } from "../impresion/escpos";
import { enviarAImpresora } from "./impresora-red";

/**
 * El almacén del local: guarda el estado en un archivo JSON en el propio PC del bar y avisa a
 * las pantallas cuando algo cambia. Es un solo proceso, así que las acciones se aplican de una
 * en una y nunca se pisan. Para varios locales o para la nube, el siguiente paso es Supabase
 * (ver docs/ARQUITECTURA.md); la interfaz de este módulo es la que habría que mantener.
 */

type Almacen = {
  estado: Estado;
  revision: number;
  eventos: EventEmitter;
  secreto: string;
};

const carpeta = () => process.env.DATOS_DIR ?? path.join(process.cwd(), "datos");
const archivo = () => path.join(carpeta(), "estado.json");

function contexto(): Contexto {
  return {
    ahora: new Date().toISOString(),
    nuevoId: () => randomUUID(),
    nuevoToken: () => randomBytes(12).toString("base64url"),
  };
}

function cargar(): Almacen {
  mkdirSync(carpeta(), { recursive: true });
  let estado: Estado;
  if (existsSync(archivo())) {
    estado = JSON.parse(readFileSync(archivo(), "utf8")) as Estado;
    if (estado.version !== VERSION_ESTADO)
      throw new Error(`El archivo ${archivo()} es de otra versión.`);
  } else {
    estado = estadoDeEjemplo(contexto(), { conHistorial: process.env.DEMO !== "false" });
    writeFileSync(archivo(), JSON.stringify(estado));
  }
  const rutaSecreto = path.join(carpeta(), "secreto");
  if (!existsSync(rutaSecreto))
    writeFileSync(rutaSecreto, randomBytes(32).toString("hex"), { mode: 0o600 });
  const eventos = new EventEmitter();
  eventos.setMaxListeners(200);
  return { estado, revision: 1, eventos, secreto: readFileSync(rutaSecreto, "utf8").trim() };
}

// En desarrollo Next recarga los módulos; el almacén vive en globalThis para no duplicarse.
const global = globalThis as typeof globalThis & { __almacenTPV?: Almacen };
function almacen(): Almacen {
  global.__almacenTPV ??= cargar();
  return global.__almacenTPV;
}

export const leerEstado = (): Estado => almacen().estado;
export const revision = () => almacen().revision;
export const secreto = () => process.env.SESION_SECRETO ?? almacen().secreto;

/**
 * Guarda en cada cambio, antes de dar la acción por buena. Escribe en un archivo temporal y lo
 * renombra: si se va la luz a mitad, el archivo anterior sigue entero.
 */
function guardar(estado: Estado) {
  const temporal = `${archivo()}.tmp`;
  writeFileSync(temporal, JSON.stringify(estado));
  renameSync(temporal, archivo());
}

function cambiar(estado: Estado) {
  const a = almacen();
  guardar(estado);
  a.estado = estado;
  a.revision += 1;
  a.eventos.emit("cambio", a.revision);
}

export function suscribirse(alCambiar: (revision: number) => void): () => void {
  const { eventos } = almacen();
  eventos.on("cambio", alCambiar);
  return () => eventos.off("cambio", alCambiar);
}

function tras(resultado: Resultado) {
  cambiar(resultado.estado);
  for (const trabajo of resultado.trabajos)
    if (trabajo.estado === "pendiente") void imprimir(trabajo);
  return resultado.trabajos.map(({ id, estado, titulo, impresoraId, destino, tipo }) => ({
    id,
    estado,
    titulo,
    impresoraId,
    destino,
    tipo,
  }));
}

export function ejecutarPersonal(accion: AccionPersonal, empleado: Empleado) {
  return tras(reducirPersonal(leerEstado(), accion, empleado, contexto()));
}

export function ejecutarCliente(token: string, accion: AccionCliente) {
  return tras(reducirCliente(leerEstado(), token, accion, contexto()));
}

/** Manda un trabajo a su impresora de red y apunta si salió bien. */
async function imprimir(trabajo: TrabajoImpresion) {
  const impresora = leerEstado().impresoras.find((i) => i.id === trabajo.impresoraId);
  let resultado: Pick<TrabajoImpresion, "estado" | "error">;
  if (!impresora) resultado = { estado: "error", error: "La impresora ya no existe." };
  else {
    try {
      await enviarAImpresora(
        impresora.ip,
        impresora.puerto,
        aEscpos(trabajo.documento, { columnas: impresora.columnas }),
      );
      resultado = { estado: "impreso" };
    } catch (e) {
      resultado = { estado: "error", error: e instanceof Error ? e.message : String(e) };
    }
  }
  const estado = leerEstado();
  cambiar({
    ...estado,
    trabajos: estado.trabajos.map((t) => (t.id === trabajo.id ? { ...t, ...resultado } : t)),
  });
}

/** Marca un trabajo como impreso (lo usa la pantalla cuando imprime desde el navegador o USB). */
export function marcarImpreso(trabajoId: string) {
  const estado = leerEstado();
  cambiar({
    ...estado,
    trabajos: estado.trabajos.map((t) =>
      t.id === trabajoId ? { ...t, estado: "impreso" as const } : t,
    ),
  });
}

/** Vuelve a los datos de ejemplo. Solo para la demostración. */
export function reiniciarDemo() {
  cambiar(estadoDeEjemplo(contexto(), { conHistorial: true }));
}

/** Comprueba un PIN. Devuelve el empleado o null. */
export function entrarConPin(pin: string): Empleado | null {
  return leerEstado().empleados.find((e) => e.activo && e.pin === pin) ?? null;
}
