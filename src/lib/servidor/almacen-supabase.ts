import "server-only";
import { createHash } from "node:crypto";
import { DIAS_EN_PANTALLA } from "../constantes";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import { ErrorAccion } from "../dominio/reducir";
import type { Estado, Ticket } from "../dominio/tipos";
import { type Almacen, contexto } from "./almacen";

/** Trabajos de impresión que se guardan en la nube (los más antiguos se olvidan). */
const MAX_TRABAJOS = 120;

/**
 * El estado en Supabase. Cada cambio lee el estado y su revisión, aplica la acción y guarda solo
 * si nadie ha guardado entre medias; si alguien lo ha hecho, vuelve a empezar. Los tickets van
 * en su propia tabla, que solo admite añadir.
 */
export function almacenSupabase(): Almacen {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const local = process.env.TPV_LOCAL ?? "la-esquina";
  const clave = process.env.TPV_CLAVE ?? "";
  if (!url || !apikey)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");

  async function rpc<T>(funcion: string, argumentos: Record<string, unknown>): Promise<T> {
    const r = await fetch(`${url}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: {
        apikey: apikey!,
        Authorization: `Bearer ${apikey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_local: local, p_clave: clave, ...argumentos }),
      cache: "no-store",
    });
    if (!r.ok) {
      const cuerpo = await r.text();
      console.error(`Supabase ${funcion}: ${r.status} ${cuerpo}`);
      throw new Error(`La base de datos no responde (${r.status}).`);
    }
    return (await r.json()) as T;
  }

  type Cargado = { revision: number; datos: Estado; tickets: Ticket[] } | null;

  async function cargar() {
    const desde = new Date(Date.now() - (DIAS_EN_PANTALLA + 1) * 86_400_000).toISOString();
    let c = await rpc<Cargado>("tpv_cargar", { p_desde: desde });
    if (!c) {
      // Primera vez: se crea el bar de ejemplo (o uno vacío si DEMO=false).
      const inicial = estadoDeEjemplo(contexto(), { conHistorial: process.env.DEMO !== "false" });
      await guardar(0, inicial, inicial.tickets);
      c = await rpc<Cargado>("tpv_cargar", { p_desde: desde });
      if (!c) throw new Error("No se ha podido crear el local en la base de datos.");
    }
    const estado = migrar({ ...c.datos, tickets: c.tickets });
    return { revision: c.revision, estado, ids: new Set(c.tickets.map((t) => t.id)) };
  }

  /** Lo que se guarda como documento: sin tickets (van aparte) ni cuentas ya cerradas. */
  function documento(estado: Estado): Estado {
    return {
      ...estado,
      tickets: [],
      cuentas: estado.cuentas.filter((c) => c.estado === "abierta"),
      trabajos: estado.trabajos.slice(-MAX_TRABAJOS),
    };
  }

  function guardar(revision: number, estado: Estado, nuevos: Ticket[]) {
    return rpc<number>("tpv_guardar", {
      p_revision: revision,
      p_datos: documento(estado),
      p_tickets: nuevos,
    });
  }

  return {
    modo: "supabase",
    async leer() {
      return (await cargar()).estado;
    },
    async cambiar(aplicar) {
      for (let intento = 0; intento < 6; intento++) {
        const { revision, estado, ids } = await cargar();
        const r = aplicar(estado);
        const nuevos = r.estado.tickets.filter((t) => !ids.has(t.id));
        if ((await guardar(revision, r.estado, nuevos)) >= 0) return r;
        await new Promise((ok) => setTimeout(ok, 40 + Math.random() * 120));
      }
      throw new ErrorAccion("Hay mucho movimiento ahora mismo. Vuelve a intentarlo.");
    },
    secreto: () => createHash("sha256").update(`sesion:${clave}`).digest("hex"),
  };
}
