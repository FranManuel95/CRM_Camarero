import "server-only";
import { DIAS_EN_PANTALLA } from "../constantes";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import { ErrorAccion } from "../dominio/reducir";
import type { Estado, Ticket } from "../dominio/tipos";
import { type Almacen, contexto } from "./almacen";
import { rpc as llamar } from "./supabase-rpc";

/** Trabajos de impresión que se guardan en la nube (los más antiguos se olvidan). */
const MAX_TRABAJOS = 120;

/**
 * El estado en Supabase. Cada cambio lee el estado y su revisión, aplica la acción y guarda solo
 * si nadie ha guardado entre medias; si alguien lo ha hecho, vuelve a empezar. Los tickets van
 * en su propia tabla, que solo admite añadir.
 */
export function almacenSupabase(local: string, esDemo: boolean): Almacen {
  const rpc = <T>(funcion: string, argumentos: Record<string, unknown>) =>
    llamar<T>(funcion, { p_local: local, ...argumentos });

  type Cargado = { revision: number; datos: Estado; tickets: Ticket[] } | null;

  async function cargar() {
    const desde = new Date(Date.now() - (DIAS_EN_PANTALLA + 1) * 86_400_000).toISOString();
    let c = await rpc<Cargado>("tpv_cargar", { p_desde: desde });
    if (!c) {
      if (!esDemo) throw new ErrorAccion("Este bar todavía no está listo.");
      // Primera vez que se abre la demostración: se crea el bar de ejemplo con su historial.
      const inicial = estadoDeEjemplo(contexto(), { conHistorial: true });
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
    async iniciar(estado) {
      if ((await guardar(0, estado, estado.tickets)) < 0)
        throw new ErrorAccion("Este bar ya estaba creado.");
    },
  };
}
