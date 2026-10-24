"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import type { Rol } from "@/lib/dominio/tipos";
import { enviarAccion, type RespuestaAccion } from "@/lib/cliente/api";
import { imprimirTrabajos, imprimirUno, tocaAqui } from "@/lib/cliente/impresion-local";
import { useEnDirecto } from "@/lib/cliente/use-en-directo";
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
  const [estado, setEstado] = useState(inicial);
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

  // Puesto de impresión: lo nuevo que llega sin impresora de red y le toca a esta pantalla.
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!vistos.current) {
      vistos.current = new Set(estado.trabajos.map((t) => t.id));
      return;
    }
    for (const t of estado.trabajos) {
      if (vistos.current.has(t.id)) continue;
      vistos.current.add(t.id);
      if (t.estado === "en_navegador" && tocaAqui(t)) imprimirUno(t.id).catch(() => {});
    }
  }, [estado.trabajos]);

  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = ++contador.current;
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
    setTimeout(
      () => setAvisos((a) => a.filter((x) => x.id !== id)),
      tipo === "error" ? 6000 : 2500,
    );
  }, []);

  const hacer = useCallback(
    async (accion: AccionPersonal, mensajeOk?: string) => {
      const r: RespuestaAccion = await enviarAccion(accion);
      if (r.error) {
        avisar(r.error, "error");
        return false;
      }
      if (mensajeOk) avisar(mensajeOk);
      // En la nube, quien hace el cambio no espera al aviso de Realtime: pide los datos ya.
      if (directo.tipo === "supabase") refrescar();
      if (r.trabajos?.length) imprimirTrabajos(r.trabajos);
      return true;
    },
    [avisar, directo.tipo, refrescar],
  );

  const valor = useMemo(
    () => ({ estado, empleado, conectado, hacer, avisar }),
    [estado, empleado, conectado, hacer, avisar],
  );

  return (
    <Contexto value={valor}>
      {children}
      {!conectado && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-aviso py-1 text-center text-sm font-semibold text-white"
        >
          Sin conexión con la caja. Reintentando…
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
