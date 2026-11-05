"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { disponible, type Funcion } from "@/lib/dominio/funciones";
import type { Permiso, Rol } from "@/lib/dominio/tipos";
import { puede } from "@/lib/dominio/permisos";
import { enviarAccion, type RespuestaAccion } from "@/lib/cliente/api";
import { imprimirTrabajos, imprimirUno, tocaAqui } from "@/lib/cliente/impresion-local";
import { useEnDirecto } from "@/lib/cliente/use-en-directo";
import {
  apuntarPendiente,
  leerPendientes,
  type Pendiente,
  quitarPendiente,
  SE_PUEDE_SIN_RED,
  suscribirPendientes,
} from "@/lib/cliente/sin-red";
import { reducirPersonal } from "@/lib/dominio/reducir";
import type { ConfigDirecto } from "@/lib/servidor/almacen";
import type { VistaPersonal } from "@/lib/servidor/vistas";

export type EmpleadoSesion = { id: string; nombre: string; rol: Rol };

type Aviso = { id: number; texto: string; tipo: "ok" | "error" };

type Datos = {
  estado: VistaPersonal;
  empleado: EmpleadoSesion;
  conectado: boolean;
  /** Manda una acción; si sale mal, enseña el error. Devuelve true si fue bien. */
  hacer: (accion: AccionPersonal, mensajeOk?: string) => Promise<boolean>;
  avisar: (texto: string, tipo?: Aviso["tipo"]) => void;
};

const Contexto = createContext<Datos | null>(null);

export function useDatos(): Datos {
  const datos = use(Contexto);
  if (!datos) throw new Error("useDatos fuera de DatosPersonal");
  return datos;
}

/**
 * Mantiene el estado del local al día en esta pantalla (ver useEnDirecto) y se reconecta solo
 * si se corta.
 */
export function DatosPersonal({
  inicial,
  empleado,
  directo,
  children,
}: {
  inicial: VistaPersonal;
  empleado: EmpleadoSesion;
  directo: ConfigDirecto;
  children: React.ReactNode;
}) {
  const [delServidor, setDelServidor] = useState(inicial);
  // Solo datos iguales o más nuevos: un aviso o una respuesta que llega tarde no pisa lo de ahora.
  const setEstado = useCallback(
    (nueva: VistaPersonal) =>
      setDelServidor((actual) =>
        (nueva.revision ?? 0) >= (actual.revision ?? 0) ? nueva : actual,
      ),
    [],
  );
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const { conectado, refrescar } = useEnDirecto<VistaPersonal>(
    directo,
    { eventos: "/api/eventos", datos: "/api/estado" },
    setEstado,
    () => {
      // Recarga completa a propósito: la sesión ha terminado y hay que empezar de cero.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/entrar");
    },
  );

  // Sin wifi: lo guardado en este aparato se ve ya aplicado encima de lo último del servidor.
  const pendientes = useSyncExternalStore(
    suscribirPendientes,
    () => leerPendientes(empleado.id),
    () => SIN_PENDIENTES,
  );
  const estado = useMemo(
    () => conPendientes(delServidor, pendientes, empleado),
    [delServidor, pendientes, empleado],
  );
  const sinRed = disponible(estado.ajustes, estado.servicios, "sinConexion");

  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = ++contador.current;
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
    setTimeout(
      () => setAvisos((a) => a.filter((x) => x.id !== id)),
      tipo === "error" ? 6000 : 2500,
    );
  }, []);

  // Puesto de impresión: lo nuevo para las impresoras conectadas a esta pantalla (y, en bares sin
  // impresoras dadas de alta, lo que le toca como puesto). Si algo falla o se reintenta desde
  // Gestión, vuelve a salir.
  const vistos = useRef<Set<string> | null>(null);
  const columnasDe = useCallback(
    (impresoraId: string | null | undefined) =>
      estado.impresoras.find((i) => i.id === impresoraId)?.columnas,
    [estado.impresoras],
  );
  useEffect(() => {
    if (!vistos.current) {
      vistos.current = new Set(estado.trabajos.map((t) => t.id));
      return;
    }
    for (const t of estado.trabajos) {
      if (t.estado !== "en_navegador") {
        vistos.current.delete(t.id);
        continue;
      }
      if (vistos.current.has(t.id)) continue;
      vistos.current.add(t.id);
      if (tocaAqui(t))
        imprimirUno(t.id, {
          impresoraId: t.impresoraId,
          columnas: columnasDe(t.impresoraId),
        }).catch((e: Error) =>
          avisar(`No se ha podido imprimir «${t.titulo}»: ${e.message}`, "error"),
        );
    }
  }, [estado.trabajos, avisar, columnasDe]);

  // Manda en orden lo guardado sin wifi. Si la red vuelve a fallar, para y lo intenta luego.
  const mandando = useRef(false);
  const mandarPendientes = useCallback(async () => {
    if (mandando.current) return;
    mandando.current = true;
    let mandados = 0;
    try {
      for (const p of leerPendientes(empleado.id)) {
        const r = await enviarAccion(p.accion);
        if (r.sinRed) break;
        quitarPendiente(empleado.id, p.id);
        if (r.error) avisar(`No se ha podido mandar algo guardado sin wifi: ${r.error}`, "error");
        else mandados++;
        if (r.trabajos?.length) imprimirTrabajos(r.trabajos, (m) => avisar(m, "error"), columnasDe);
      }
    } finally {
      mandando.current = false;
    }
    if (mandados) {
      avisar("Ya está mandado lo que se guardó sin wifi");
      refrescar();
    }
  }, [avisar, empleado.id, refrescar, columnasDe]);

  const hayPendientes = pendientes.length > 0;
  useEffect(() => {
    if (!hayPendientes) return;
    void mandarPendientes();
    const reintento = setInterval(() => void mandarPendientes(), 10_000);
    const alVolver = () => void mandarPendientes();
    window.addEventListener("online", alVolver);
    return () => {
      clearInterval(reintento);
      window.removeEventListener("online", alVolver);
    };
  }, [hayPendientes, conectado, mandarPendientes]);

  const hacer = useCallback(
    async (accion: AccionPersonal, mensajeOk?: string) => {
      const guardable = sinRed && SE_PUEDE_SIN_RED.has(accion.tipo);
      // Si ya hay cosas esperando, lo nuevo va detrás para que lleguen en orden.
      if (guardable && leerPendientes(empleado.id).length) {
        apuntarPendiente(empleado.id, accion);
        return true;
      }
      const r: RespuestaAccion = await enviarAccion(accion);
      if (r.sinRed && guardable) {
        apuntarPendiente(empleado.id, accion);
        avisar("Sin wifi: guardado en este móvil. Se manda solo al volver la conexión.");
        return true;
      }
      if (r.error) {
        avisar(r.error, "error");
        return false;
      }
      if (mensajeOk) avisar(mensajeOk);
      // Quien hace el cambio no espera al aviso en directo: la respuesta ya trae cómo queda.
      if (r.vista) setEstado(r.vista);
      else if (directo.tipo === "supabase") refrescar();
      if (r.trabajos?.length) imprimirTrabajos(r.trabajos, (m) => avisar(m, "error"), columnasDe);
      return true;
    },
    [avisar, directo.tipo, refrescar, sinRed, empleado.id, columnasDe, setEstado],
  );

  const valor = useMemo(
    () => ({ estado, empleado, conectado, hacer, avisar }),
    [estado, empleado, conectado, hacer, avisar],
  );

  return (
    <Contexto value={valor}>
      {children}
      {(!conectado || hayPendientes) && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-aviso px-2 py-1 text-center text-sm font-semibold text-white"
        >
          {hayPendientes
            ? `Sin conexión: ${pendientes.length} ${pendientes.length === 1 ? "cosa guardada" : "cosas guardadas"} en este aparato. Se mandan al volver.`
            : "Sin conexión con la caja. Reintentando…"}
        </div>
      )}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {avisos.map((a) => (
          <p
            key={a.id}
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              a.tipo === "error" ? "bg-aviso" : "bg-tinta"
            }`}
          >
            {a.texto}
          </p>
        ))}
      </div>
    </Contexto>
  );
}

/** ¿Se puede usar esta función en este bar? (encendida y, si hace falta, con su clave). */
export function useFuncion(funcion: Funcion): boolean {
  const { estado } = useDatos();
  return disponible(estado.ajustes, estado.servicios, funcion);
}

/** ¿Puede la persona que está usando la app hacer esto? (cobrar, anular, invitar…) */
export function usePuede(permiso: Permiso): boolean {
  const { estado, empleado } = useDatos();
  const yo = estado.empleados.find((e) => e.id === empleado.id) ?? { ...empleado };
  return puede(estado.ajustes, yo, permiso);
}

const SIN_PENDIENTES: Pendiente[] = [];

/**
 * Aplica lo pendiente con el mismo reductor que el servidor, para que la pantalla lo enseñe ya.
 * Lo que no se pueda aplicar (por ejemplo, porque otro ya lo hizo) se salta.
 */
function conPendientes(
  base: VistaPersonal,
  pendientes: Pendiente[],
  quien: EmpleadoSesion,
): VistaPersonal {
  if (!pendientes.length) return base;
  const empleado = base.empleados.find((e) => e.id === quien.id) ?? {
    ...quien,
    pin: "",
    activo: true,
  };
  let estado = base;
  for (const p of pendientes) {
    let n = 0;
    const ctx = {
      ahora: p.en,
      nuevoId: () => `${p.id}-${++n}`,
      nuevoToken: () => `${p.id}-t${++n}`,
      nuevoCodigo: () => "000000",
    };
    try {
      estado = { ...estado, ...reducirPersonal(estado, p.accion, empleado, ctx).estado };
    } catch {
      // Ya no se puede (la mesa la cerró otro, el plato se agotó…): el servidor dirá.
    }
  }
  return estado;
}
