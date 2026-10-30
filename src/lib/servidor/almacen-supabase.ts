import "server-only";
import { DIAS_EN_PANTALLA } from "../constantes";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import { ErrorAccion } from "../dominio/reducir";
import { cuentaEnJuego } from "../dominio/selectores";
import type { Estado, Fichaje, Ticket } from "../dominio/tipos";
import { type Almacen, contexto } from "./almacen";
import { rpc as llamar } from "./supabase-rpc";

/** Para pedir «todo» a la base de datos. */
const DESDE_SIEMPRE = "2000-01-01T00:00:00Z";
const HASTA_SIEMPRE = "2100-01-01T00:00:00Z";

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

  type Cargado = {
    revision: number;
    datos: Estado;
    tickets: Ticket[];
    fichajes?: Fichaje[];
  } | null;

  async function cargar() {
    const desde = new Date(Date.now() - (DIAS_EN_PANTALLA + 1) * 86_400_000).toISOString();
    let c = await rpc<Cargado>("tpv_cargar", { p_desde: desde });
    if (!c) {
      if (!esDemo) throw new ErrorAccion("Este bar todavía no está listo.");
      // Primera vez que se abre la demostración: se crea el bar de ejemplo con su historial.
      const inicial = estadoDeEjemplo(contexto(), { conHistorial: true });
      await guardar(0, inicial, inicial.tickets, inicial.fichajes);
      c = await rpc<Cargado>("tpv_cargar", { p_desde: desde });
      if (!c) throw new Error("No se ha podido crear el local en la base de datos.");
    }
    const fichajes = c.fichajes ?? [];
    const estado = { ...migrar({ ...c.datos, tickets: c.tickets }), fichajes };
    return {
      revision: c.revision,
      estado,
      ids: new Set(c.tickets.map((t) => t.id)),
      // Para saber qué fichajes han cambiado y guardar solo esos.
      previos: new Map(fichajes.map((f) => [f.id, JSON.stringify(f)])),
    };
  }

  /** Lo que se guarda como documento: sin tickets ni fichajes (van aparte) ni cuentas cerradas. */
  function documento(estado: Estado): Estado {
    return {
      ...estado,
      tickets: [],
      fichajes: [],
      cuentas: estado.cuentas.filter((c) => cuentaEnJuego(c)),
      trabajos: estado.trabajos.slice(-MAX_TRABAJOS),
    };
  }

  function guardar(revision: number, estado: Estado, nuevos: Ticket[], fichajes: Fichaje[]) {
    return rpc<number>("tpv_guardar_v2", {
      p_revision: revision,
      p_datos: documento(estado),
      p_tickets: nuevos,
      p_fichajes: fichajes,
    });
  }

  return {
    modo: "supabase",
    async leer() {
      return (await cargar()).estado;
    },
    async completo() {
      const { estado } = await cargar();
      const [tickets, fichajes] = await Promise.all([
        rpc<Ticket[]>("tpv_tickets", { p_desde: DESDE_SIEMPRE, p_hasta: HASTA_SIEMPRE }),
        rpc<Fichaje[]>("tpv_fichajes", { p_desde: DESDE_SIEMPRE, p_hasta: HASTA_SIEMPRE }),
      ]);
      return { ...estado, tickets, fichajes };
    },
    fichajesEntre: (desde, hasta) =>
      rpc<Fichaje[]>("tpv_fichajes", { p_desde: desde, p_hasta: hasta }),
    ticketsEntre: (desde, hasta) =>
      rpc<Ticket[]>("tpv_tickets", { p_desde: desde, p_hasta: hasta }),
    async cambiar(aplicar) {
      for (let intento = 0; intento < 6; intento++) {
        const { revision, estado, ids, previos } = await cargar();
        const r = aplicar(estado);
        const nuevos = r.estado.tickets.filter((t) => !ids.has(t.id));
        const fichajes = r.estado.fichajes.filter((f) => previos.get(f.id) !== JSON.stringify(f));
        if ((await guardar(revision, r.estado, nuevos, fichajes)) >= 0) return r;
        await new Promise((ok) => setTimeout(ok, 40 + Math.random() * 120));
      }
      throw new ErrorAccion("Hay mucho movimiento ahora mismo. Vuelve a intentarlo.");
    },
    async iniciar(estado) {
      if ((await guardar(0, estado, estado.tickets, estado.fichajes)) < 0)
        throw new ErrorAccion("Este bar ya estaba creado.");
    },
  };
}
