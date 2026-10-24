import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AccionCliente, AccionPersonal } from "../dominio/acciones";
import { resumenPin } from "../dominio/pin";
import { type Contexto, type Resultado, reducirCliente, reducirPersonal } from "../dominio/reducir";
import type { Empleado, Estado, TrabajoImpresion } from "../dominio/tipos";
import { almacenArchivo } from "./almacen-archivo";
import { almacenSupabase } from "./almacen-supabase";

/**
 * Dónde se guarda el estado del local. Dos formas, con la misma interfaz:
 * - **archivo** (por defecto): un JSON en el ordenador del bar. Funciona sin internet y el
 *   servidor imprime directamente en las impresoras de red.
 * - **supabase** (si hay TPV_CLAVE): en la nube, para tenerlo en internet (Vercel). Las
 *   impresoras de red las atiende el «puente de impresión» que corre en el bar.
 */
export type Almacen = {
  modo: "archivo" | "supabase";
  leer(): Promise<Estado>;
  /** Aplica un cambio de forma segura frente a otras pantallas; reintenta si hace falta. */
  cambiar(aplicar: (estado: Estado) => Resultado): Promise<Resultado>;
  /** Para la sesión del personal. */
  secreto(): string;
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
  };
}

const global = globalThis as typeof globalThis & { __almacenTPV?: Almacen };

export function almacen(): Almacen {
  global.__almacenTPV ??= process.env.TPV_CLAVE ? almacenSupabase() : almacenArchivo();
  return global.__almacenTPV;
}

/** Cómo reciben las pantallas los cambios en directo. */
export type ConfigDirecto =
  { tipo: "sse" } | { tipo: "supabase"; url: string; clave: string; canal: string };

export function configDirecto(): ConfigDirecto {
  const a = almacen();
  if (a.modo === "archivo") return { tipo: "sse" };
  return {
    tipo: "supabase",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    canal: `tpv:${process.env.TPV_LOCAL ?? "la-esquina"}`,
  };
}

export const leerEstado = () => almacen().leer();
export const secreto = () => process.env.SESION_SECRETO ?? almacen().secreto();

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

async function tras(resultado: Promise<Resultado>) {
  const r = await resultado;
  const a = almacen();
  if (a.imprimirEnRed) for (const t of r.trabajos) if (t.estado === "pendiente") a.imprimirEnRed(t);
  return resumir(r.trabajos);
}

export function ejecutarPersonal(accion: AccionPersonal, empleado: Empleado) {
  return tras(almacen().cambiar((e) => reducirPersonal(e, accion, empleado, contexto())));
}

export function ejecutarCliente(token: string, accion: AccionCliente) {
  return tras(almacen().cambiar((e) => reducirCliente(e, token, accion, contexto())));
}

/** Apunta cómo ha ido un trabajo de impresión (desde una pantalla, el puente o el servidor). */
export async function marcarTrabajo(
  trabajoId: string,
  cambios: Pick<TrabajoImpresion, "estado" | "error">,
) {
  await almacen().cambiar((estado) => ({
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

export async function entrarConPin(pin: string): Promise<Empleado | null> {
  const resumen = resumenPin(pin);
  return (await leerEstado()).empleados.find((e) => e.activo && e.pin === resumen) ?? null;
}

/** Clave que usa el puente de impresión del bar (sale de la del local; no hace falta guardarla). */
export function clavePuente(): string {
  return createHash("sha256")
    .update(`puente:${almacen().secreto()}`)
    .digest("base64url")
    .slice(0, 32);
}
