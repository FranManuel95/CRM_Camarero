import "server-only";
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import type { AccionCliente, AccionPersonal } from "../dominio/acciones";
import { resumenPin } from "../dominio/pin";
import {
  type Contexto,
  type Resultado,
  reducirCliente,
  reducirPersonal,
  usarCodigoVinculo,
} from "../dominio/reducir";
import type { Empleado, Estado, TrabajoImpresion } from "../dominio/tipos";
import { almacenArchivo } from "./almacen-archivo";
import { almacenSupabase } from "./almacen-supabase";

/**
 * Dónde se guarda el estado de cada bar. Dos formas, con la misma interfaz:
 * - **archivo** (por defecto): un JSON en el ordenador del bar, para un solo bar. Funciona sin
 *   internet y el servidor imprime directamente en las impresoras de red.
 * - **supabase** (si hay TPV_CLAVE): en la nube, para muchos bares. Las impresoras de red las
 *   atiende el «puente de impresión» que corre en cada bar.
 */
export type Almacen = {
  modo: "archivo" | "supabase";
  leer(): Promise<Estado>;
  /** Aplica un cambio de forma segura frente a otras pantallas; reintenta si hace falta. */
  cambiar(aplicar: (estado: Estado) => Resultado): Promise<Resultado>;
  /** Solo en la nube: guarda el estado inicial de un bar recién creado. */
  iniciar?(estado: Estado): Promise<void>;
  /** Solo en modo archivo: avisos de cambios para el flujo SSE. */
  suscribirse?(alCambiar: () => void): () => void;
  reiniciar?(): Promise<void>;
  /** Solo en modo archivo: el servidor imprime él mismo en las impresoras de red. */
  imprimirEnRed?(trabajo: TrabajoImpresion): void;
};

export type TrabajoResumen = Pick<
  TrabajoImpresion,
  "id" | "estado" | "titulo" | "impresoraId" | "destino" | "tipo"
>;

export function contexto(): Contexto {
  return {
    ahora: new Date().toISOString(),
    nuevoId: () => randomUUID(),
    nuevoToken: () => randomBytes(12).toString("base64url"),
    nuevoCodigo: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  };
}

/** En la nube hay muchos bares; en el ordenador del bar, uno solo. */
export const enLaNube = () => Boolean(process.env.TPV_CLAVE);

/** El identificador del único bar en modo archivo. */
export const LOCAL_ARCHIVO = "local";

/** El bar de demostración (el que se enseña sin cuenta). */
export const localDemo = () =>
  enLaNube() ? (process.env.TPV_LOCAL ?? "la-esquina") : LOCAL_ARCHIVO;

const global = globalThis as typeof globalThis & { __almacenesTPV?: Map<string, Almacen> };

export function almacen(local: string): Almacen {
  global.__almacenesTPV ??= new Map();
  const clave = enLaNube() ? local : LOCAL_ARCHIVO;
  let a = global.__almacenesTPV.get(clave);
  if (!a) {
    a = enLaNube() ? almacenSupabase(local, local === localDemo()) : almacenArchivo();
    global.__almacenesTPV.set(clave, a);
  }
  return a;
}

/** Cómo reciben las pantallas de un bar los cambios en directo. */
export type ConfigDirecto =
  { tipo: "sse" } | { tipo: "supabase"; url: string; clave: string; canal: string };

export function configDirecto(local: string): ConfigDirecto {
  if (!enLaNube()) return { tipo: "sse" };
  return {
    tipo: "supabase",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    canal: `tpv:${local}`,
  };
}

/** Secreto para firmar sesiones y claves derivadas. */
export function secreto(): string {
  if (process.env.SESION_SECRETO) return process.env.SESION_SECRETO;
  if (enLaNube())
    return createHash("sha256").update(`sesion:${process.env.TPV_CLAVE}`).digest("hex");
  return almacenArchivo.secreto();
}

export const leerEstado = (local: string) => almacen(local).leer();

function resumir(trabajos: TrabajoImpresion[]): TrabajoResumen[] {
  return trabajos.map(({ id, estado, titulo, impresoraId, destino, tipo }) => ({
    id,
    estado,
    titulo,
    impresoraId,
    destino,
    tipo,
  }));
}

async function tras(a: Almacen, resultado: Promise<Resultado>) {
  const r = await resultado;
  if (a.imprimirEnRed) for (const t of r.trabajos) if (t.estado === "pendiente") a.imprimirEnRed(t);
  return resumir(r.trabajos);
}

export function ejecutarPersonal(local: string, accion: AccionPersonal, empleado: Empleado) {
  const a = almacen(local);
  return tras(
    a,
    a.cambiar((e) => reducirPersonal(e, accion, empleado, contexto())),
  );
}

export function ejecutarCliente(local: string, token: string, accion: AccionCliente) {
  const a = almacen(local);
  return tras(
    a,
    a.cambiar((e) => reducirCliente(e, token, accion, contexto())),
  );
}

/** Apunta cómo ha ido un trabajo de impresión (desde una pantalla, el puente o el servidor). */
export async function marcarTrabajo(
  local: string,
  trabajoId: string,
  cambios: Pick<TrabajoImpresion, "estado" | "error">,
) {
  await almacen(local).cambiar((estado) => ({
    estado: {
      ...estado,
      trabajos: estado.trabajos.map((t) => {
        if (t.id !== trabajoId) return t;
        const { error: _e, ...resto } = t;
        void _e;
        return cambios.error ? { ...resto, ...cambios } : { ...resto, estado: cambios.estado };
      }),
    },
    trabajos: [],
  }));
}

/** Gasta un código de vinculación de un aparato. Falla si no vale. */
export async function gastarCodigoVinculo(local: string, codigo: string) {
  await almacen(local).cambiar((estado) => ({
    estado: usarCodigoVinculo(estado, codigo, new Date().toISOString()),
    trabajos: [],
  }));
}

export async function entrarConPin(local: string, pin: string): Promise<Empleado | null> {
  const resumen = resumenPin(pin);
  return (await leerEstado(local)).empleados.find((e) => e.activo && e.pin === resumen) ?? null;
}

/** Clave del puente de impresión de un bar: «bar.firma». Sale del secreto; no se guarda. */
export function clavePuente(local: string): string {
  const firma = createHmac("sha256", secreto())
    .update(`puente:${local}`)
    .digest("base64url")
    .slice(0, 32);
  return `${local}.${firma}`;
}

/** Comprueba una clave de puente y devuelve el bar al que pertenece. */
export function localDePuente(clave: string): string | null {
  const local = clave.split(".")[0] ?? "";
  if (!/^[a-z0-9-]{3,40}$/.test(local)) return null;
  const esperada = Buffer.from(clavePuente(local));
  const recibida = Buffer.from(clave);
  return esperada.length === recibida.length && esperada.equals(recibida) ? local : null;
}
