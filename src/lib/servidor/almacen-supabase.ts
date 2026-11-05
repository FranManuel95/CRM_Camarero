import "server-only";
import { DIAS_EN_PANTALLA } from "../constantes";
import { estadoDeEjemplo } from "../dominio/demo";
import { migrar } from "../dominio/migraciones";
import { ErrorAccion } from "../dominio/reducir";
import { cuentaEnJuego } from "../dominio/selectores";
import type { Estado, Fichaje, Ticket } from "../dominio/tipos";
import { type Almacen, contexto, type ExtrasDeCarga } from "./almacen";
import { masPedidos } from "../dominio/rapidos";
import { horaLocal } from "../fechas";
import { rpc as llamar } from "./supabase-rpc";

/** Para pedir «todo» a la base de datos. */
const DESDE_SIEMPRE = "2000-01-01T00:00:00Z";
const HASTA_SIEMPRE = "2100-01-01T00:00:00Z";

/** Horas de tickets que se leen con el bar (lo demás, cuando hace falta). */
const HORAS_TICKETS = 36;

/** Si la base de datos aún no tiene tpv_cargar_v3: hasta cuándo no se vuelve a probar. */
let sinCargaV3 = 0;

/** «Rápidos» por bar y hora, recordados un rato en este servidor. */
const rapidos = new Map<string, { lista: string[]; hasta: number }>();

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
    ultimos?: Ticket[];
    fichajes?: Fichaje[];
  } | null;

  /** La función nueva de la base de datos (o la de antes, si aún no está puesta). */
  async function leerBase(desde: string): Promise<Cargado> {
    if (!sinCargaV3 || Date.now() > sinCargaV3) {
      try {
        return await rpc<Cargado>("tpv_cargar_v3", { p_desde: desde });
      } catch (e) {
        if (!(e instanceof Error && e.message.includes("(404)"))) throw e;
        sinCargaV3 = Date.now() + 10 * 60_000;
      }
    }
    return rpc<Cargado>("tpv_cargar", { p_desde: desde });
  }

  /**
   * Lee el bar. Solo los tickets de las últimas horas (y los del turno abierto), no los de meses:
   * las pantallas solo necesitan esos y los informes piden su periodo aparte. Los fichajes, los
   * del periodo de las pantallas (son pocos).
   */
  async function cargar(extras?: ExtrasDeCarga) {
    const ahora = Date.now();
    const desde = new Date(ahora - HORAS_TICKETS * 3_600_000).toISOString();
    const desdeFichajes = new Date(ahora - (DIAS_EN_PANTALLA + 1) * 86_400_000).toISOString();
    const pedirFichajes = () =>
      rpc<Fichaje[]>("tpv_fichajes", { p_desde: desdeFichajes, p_hasta: HASTA_SIEMPRE });
    let [c, delPeriodo] = await Promise.all([leerBase(desde), pedirFichajes()]);
    if (!c) {
      if (!esDemo) throw new ErrorAccion("Este bar todavía no está listo.");
      // Primera vez que se abre la demostración: se crea el bar de ejemplo con su historial.
      const inicial = estadoDeEjemplo(contexto(), { conHistorial: true });
      await guardar(0, inicial, inicial.tickets, inicial.fichajes);
      [c, delPeriodo] = await Promise.all([leerBase(desde), pedirFichajes()]);
      if (!c) throw new Error("No se ha podido crear el local en la base de datos.");
    }
    // Los abiertos (aunque sean viejos) vienen con la carga; los demás, del periodo.
    const fichajes = [
      ...new Map([...delPeriodo, ...(c.fichajes ?? [])].map((f) => [f.id, f])).values(),
    ];
    const datos = migrar({ ...c.datos, tickets: c.tickets });
    let tickets = c.tickets;
    let ticketsDesde = desde;
    const traer = async (lista: Ticket[]) => {
      const vistos = new Set(tickets.map((t) => t.id));
      tickets = [...tickets, ...lista.filter((t) => !vistos.has(t.id))].sort(
        (a, b) => a.fecha.localeCompare(b.fecha) || a.secuencia - b.secuencia,
      );
    };
    // Un turno abierto desde antes (por ejemplo, desde ayer): sus tickets hacen falta para el cierre.
    const abierto = datos.turnos.find((t) => !t.cerradoEn);
    if (abierto && abierto.abiertoEn < desde) {
      await traer(
        await rpc<Ticket[]>("tpv_tickets", { p_desde: abierto.abiertoEn, p_hasta: desde }),
      );
      ticketsDesde = abierto.abiertoEn;
    }
    for (const id of extras?.turnos ?? []) {
      const turno = datos.turnos.find((t) => t.id === id);
      if (turno && turno.abiertoEn < ticketsDesde)
        await traer(
          await rpc<Ticket[]>("tpv_tickets", {
            p_desde: turno.abiertoEn,
            p_hasta: turno.cerradoEn
              ? new Date(Date.parse(turno.cerradoEn) + 1).toISOString()
              : desde,
          }),
        );
    }
    const faltan = (extras?.tickets ?? []).filter((id) => !tickets.some((t) => t.id === id));
    if (faltan.length) await traer(await ticketsPorId(faltan));
    const estado: Estado = {
      ...datos,
      tickets,
      fichajes,
      revision: c.revision,
      ticketsDesde,
      ultimosTickets: c.ultimos ?? [],
      masPedidos: await masPedidosAhora(),
    };
    return {
      revision: c.revision,
      estado,
      ids: new Set([...tickets, ...(c.ultimos ?? [])].map((t) => t.id)),
      // Para saber qué fichajes han cambiado y guardar solo esos.
      previos: new Map(fichajes.map((f) => [f.id, JSON.stringify(f)])),
    };
  }

  async function ticketsPorId(ids: string[]): Promise<Ticket[]> {
    try {
      return await rpc<Ticket[]>("tpv_tickets_por_id", { p_ids: ids });
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("(404)"))) throw e;
      // Sin la función nueva: se buscan entre todos (solo pasa al rectificar uno antiguo).
      const todos = await rpc<Ticket[]>("tpv_tickets", {
        p_desde: DESDE_SIEMPRE,
        p_hasta: HASTA_SIEMPRE,
      });
      return todos.filter((t) => ids.includes(t.id));
    }
  }

  /** Lo más pedido a esta hora, calculado en la base de datos y recordado media hora. */
  async function masPedidosAhora(): Promise<string[]> {
    const hora = horaLocal(new Date().toISOString());
    const clave = `${local}|${hora}`;
    const recordado = rapidos.get(clave);
    if (recordado && recordado.hasta > Date.now()) return recordado.lista;
    let lista: string[] = [];
    try {
      lista = await rpc<string[]>("tpv_mas_pedidos", { p_hora: hora });
      if (lista.length < 6) lista = await rpc<string[]>("tpv_mas_pedidos", { p_hora: null });
    } catch {
      // Sin la función nueva: con los tickets de cuatro semanas (una vez cada media hora).
      const desde = new Date(Date.now() - 28 * 86_400_000).toISOString();
      lista = masPedidos(
        await rpc<Ticket[]>("tpv_tickets", { p_desde: desde, p_hasta: HASTA_SIEMPRE }).catch(
          () => [],
        ),
        new Date().toISOString(),
      );
    }
    if (rapidos.size > 2000) rapidos.clear();
    rapidos.set(clave, { lista, hasta: Date.now() + 30 * 60_000 });
    return lista;
  }

  /** Lo que se guarda como documento: sin tickets ni fichajes (van aparte) ni cuentas cerradas. */
  function documento(estado: Estado): Estado {
    // Lo que solo existe al leer no se guarda.
    const {
      revision: _r,
      ticketsDesde: _d,
      ultimosTickets: _u,
      masPedidos: _m,
      ...guardable
    } = estado;
    void [_r, _d, _u, _m];
    return {
      ...guardable,
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
    async cambiar(aplicar, extras) {
      for (let intento = 0; intento < 6; intento++) {
        const { revision, estado, ids, previos } = await cargar(extras);
        const r = aplicar(estado);
        const nuevos = r.estado.tickets.filter((t) => !ids.has(t.id));
        const fichajes = r.estado.fichajes.filter((f) => previos.get(f.id) !== JSON.stringify(f));
        const nueva = await guardar(revision, r.estado, nuevos, fichajes);
        if (nueva >= 0) {
          r.estado.revision = nueva;
          return r;
        }
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
