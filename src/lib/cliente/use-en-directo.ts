"use client";

import { useEffect, useRef, useState } from "react";
import type { ConfigDirecto } from "../servidor/almacen";

/**
 * Recibe los cambios del local en directo y llama a `alRecibir` con los datos nuevos.
 * - En el ordenador del bar: flujo de eventos del servidor (SSE) que trae los datos.
 * - En la nube: Supabase Realtime solo avisa de que hay cambios («revisión 123») y la pantalla
 *   pide los datos a la app, que comprueba quién es. Así por Realtime no viaja nada privado.
 * Devuelve si está conectado. Cuando el servidor dice que ya no hay acceso, llama a `alTerminar`.
 */
export function useEnDirecto<T>(
  directo: ConfigDirecto,
  rutas: { eventos: string; datos: string },
  alRecibir: (datos: T) => void,
  alTerminar: () => void,
): { conectado: boolean; refrescar: () => void } {
  const [conectado, setConectado] = useState(true);
  const recibir = useRef(alRecibir);
  const terminar = useRef(alTerminar);
  const refrescarRef = useRef<() => void>(() => {});
  useEffect(() => {
    recibir.current = alRecibir;
    terminar.current = alTerminar;
  });

  const { eventos, datos } = rutas;
  const tipo = directo.tipo;
  const url = directo.tipo === "supabase" ? directo.url : "";
  const clave = directo.tipo === "supabase" ? directo.clave : "";
  const canal = directo.tipo === "supabase" ? directo.canal : "";

  useEffect(() => {
    const marcar = () => {
      // Marca que la pantalla ya recibe datos en directo (lo usan las pruebas).
      document.documentElement.dataset.conectado = "1";
      setConectado(true);
    };

    if (tipo === "sse") {
      const fuente = new EventSource(eventos);
      fuente.onmessage = (e) => {
        recibir.current(JSON.parse(e.data) as T);
        marcar();
      };
      fuente.addEventListener("fin", () => {
        fuente.close();
        terminar.current();
      });
      fuente.onerror = () => setConectado(false);
      return () => fuente.close();
    }

    let cerrado = false;
    let pidiendo = false;
    let otraVez = false;
    async function pedir() {
      if (pidiendo) {
        otraVez = true;
        return;
      }
      pidiendo = true;
      try {
        const r = await fetch(datos, { cache: "no-store" });
        if (r.status === 401 || r.status === 404) return terminar.current();
        if (!r.ok) throw new Error(String(r.status));
        if (!cerrado) {
          recibir.current((await r.json()) as T);
          marcar();
        }
      } catch {
        if (!cerrado) setConectado(false);
      } finally {
        pidiendo = false;
        if (otraVez && !cerrado) {
          otraVez = false;
          void pedir();
        }
      }
    }
    refrescarRef.current = () => void pedir();

    let quitar = () => {};
    void import("@supabase/supabase-js").then(({ createClient }) => {
      if (cerrado) return;
      const supabase = createClient(url, clave, { auth: { persistSession: false } });
      const suscripcion = supabase
        .channel(canal)
        .on("broadcast", { event: "cambio" }, () => void pedir())
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") void pedir();
          else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") setConectado(false);
        });
      quitar = () => void supabase.removeChannel(suscripcion);
    });
    // Por si el móvil se duerme y se pierde algún aviso: al volver, y cada minuto, se refresca.
    const alVolver = () => {
      if (document.visibilityState === "visible") void pedir();
    };
    document.addEventListener("visibilitychange", alVolver);
    const reloj = setInterval(() => void pedir(), 60_000);
    return () => {
      cerrado = true;
      quitar();
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [tipo, url, clave, canal, eventos, datos]);

  return { conectado, refrescar: () => refrescarRef.current() };
}
