"use client";

import { useEffect } from "react";

/** Un pitido corto (si el navegador deja sonar audio: hace falta haber tocado la pantalla). */
export function pitar() {
  try {
    const audio = new AudioContext();
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    oscilador.frequency.value = 880;
    volumen.gain.setValueAtTime(0.15, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.4);
  } catch {
    // Sin audio: no pasa nada.
  }
}

/** Vibra el móvil (en el bolsillo del camarero se nota aunque no mire). */
export function vibrar() {
  try {
    navigator.vibrate?.([150, 80, 150]);
  } catch {
    // Sin vibración: no pasa nada.
  }
}

type Bloqueo = { release(): Promise<void>; released: boolean };
type ConWakeLock = Navigator & { wakeLock?: { request(tipo: "screen"): Promise<Bloqueo> } };

/**
 * Que la pantalla no se apague sola mientras esté abierta: la tablet de cocina, la pantalla de
 * pedidos o la que imprime. Al volver a la pestaña se pide otra vez (el sistema lo suelta al
 * esconderla).
 */
export function useMantenerEncendida(activo: boolean) {
  useEffect(() => {
    const api = (navigator as ConWakeLock).wakeLock;
    if (!activo || !api) return;
    let bloqueo: Bloqueo | null = null;
    let vigente = true;
    const pedir = () => {
      if (document.visibilityState !== "visible" || (bloqueo && !bloqueo.released)) return;
      api
        .request("screen")
        .then((b) => {
          if (vigente) bloqueo = b;
          else void b.release();
        })
        .catch(() => {
          // Batería baja o el navegador no deja: no pasa nada.
        });
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      vigente = false;
      document.removeEventListener("visibilitychange", pedir);
      void bloqueo?.release().catch(() => {});
    };
  }, [activo]);
}
