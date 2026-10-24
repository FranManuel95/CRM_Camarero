"use client";

import type { RespuestaAccion } from "./api";

/**
 * Impresión desde esta pantalla, para cuando la impresora no está en la red del local:
 * - «navegador»: el diálogo de imprimir del sistema (vale para cualquier impresora instalada
 *   en el PC o el móvil, también las térmicas con su driver).
 * - «usb»: bytes ESC/POS directos a una térmica por USB con WebUSB (Chrome o Edge, y solo en
 *   https o en localhost). Más rápido y sin diálogo, y abre el cajón.
 */
export type ConfigImpresion = {
  metodo: "navegador" | "usb" | "ninguno";
  columnas: number;
  /** Lo que se imprime aquí aunque lo pidan desde otra pantalla (puesto de impresión). */
  estacion: { cocina: boolean; barra: boolean; tickets: boolean };
};

export const CLAVE_CONFIG = "comanda.impresion";
export const CONFIG_POR_DEFECTO: ConfigImpresion = {
  metodo: "navegador",
  columnas: 48,
  estacion: { cocina: false, barra: false, tickets: false },
};

export function leerConfig(): ConfigImpresion {
  try {
    const guardada = localStorage.getItem(CLAVE_CONFIG);
    return guardada
      ? { ...CONFIG_POR_DEFECTO, ...(JSON.parse(guardada) as Partial<ConfigImpresion>) }
      : CONFIG_POR_DEFECTO;
  } catch {
    return CONFIG_POR_DEFECTO;
  }
}

// --- WebUSB (tipos mínimos: no todos los navegadores lo tienen) ---
type Endpoint = { direction: "in" | "out"; type: string; endpointNumber: number };
type Interfaz = { interfaceNumber: number; alternate: { endpoints: Endpoint[] } };
type DispositivoUsb = {
  productName?: string;
  opened: boolean;
  configuration: { interfaces: Interfaz[] } | null;
  open(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpoint: number, datos: BufferSource): Promise<unknown>;
};
type Usb = {
  requestDevice(o: { filters: unknown[] }): Promise<DispositivoUsb>;
  getDevices(): Promise<DispositivoUsb[]>;
};

const usb = () =>
  typeof navigator !== "undefined" ? (navigator as Navigator & { usb?: Usb }).usb : undefined;
export const hayWebUsb = () => Boolean(usb()) && window.isSecureContext;

let conectado: { dispositivo: DispositivoUsb; endpoint: number } | null = null;

async function abrir(dispositivo: DispositivoUsb) {
  if (!dispositivo.opened) await dispositivo.open();
  if (!dispositivo.configuration) await dispositivo.selectConfiguration(1);
  for (const interfaz of dispositivo.configuration?.interfaces ?? []) {
    const salida = interfaz.alternate.endpoints.find(
      (e) => e.direction === "out" && e.type === "bulk",
    );
    if (salida) {
      await dispositivo.claimInterface(interfaz.interfaceNumber);
      conectado = { dispositivo, endpoint: salida.endpointNumber };
      return dispositivo.productName ?? "Impresora USB";
    }
  }
  throw new Error("Este aparato USB no parece una impresora.");
}

/** Pide permiso para usar una impresora USB (tiene que ser al pulsar un botón). */
export async function conectarUsb(): Promise<string> {
  const api = usb();
  if (!api) throw new Error("Este navegador no puede usar USB. Prueba con Chrome o Edge.");
  return abrir(await api.requestDevice({ filters: [] }));
}

async function enviarUsb(bytes: ArrayBuffer) {
  if (!conectado) {
    const [previo] = (await usb()?.getDevices()) ?? [];
    if (!previo)
      throw new Error("No hay impresora USB conectada. Conéctala en Ajustes de impresión.");
    await abrir(previo);
  }
  await conectado!.dispositivo.transferOut(conectado!.endpoint, bytes);
}

function imprimirEnNavegador(id: string, columnas: number) {
  // Un iframe escondido: el diálogo de imprimir sale sin abrir otra pestaña y sin bloqueos.
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
  marco.src = `/imprimir/${id}?columnas=${columnas}`;
  marco.onload = () => {
    marco.contentWindow?.focus();
    marco.contentWindow?.print();
    setTimeout(() => marco.remove(), 60_000);
  };
  document.body.append(marco);
}

const yaImpresos = new Set<string>();

export async function imprimirUno(id: string, config = leerConfig()) {
  if (yaImpresos.has(id) || config.metodo === "ninguno") return;
  yaImpresos.add(id);
  if (config.metodo === "usb") {
    const r = await fetch(`/api/trabajos/${id}?columnas=${config.columnas}`);
    await enviarUsb(await r.arrayBuffer());
  } else {
    imprimirEnNavegador(id, config.columnas);
  }
  await fetch(`/api/trabajos/${id}`, { method: "POST" });
}

/**
 * Tras una acción hecha en esta pantalla: imprime aquí lo que no tiene impresora de red.
 * Las comandas no: esas las imprime el puesto de cocina o barra, si lo hay.
 */
export function imprimirTrabajos(trabajos: NonNullable<RespuestaAccion["trabajos"]>) {
  for (const t of trabajos) {
    if (t.estado !== "en_navegador" || t.tipo === "comanda") continue;
    imprimirUno(t.id).catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
  }
}

/** ¿Le toca a esta pantalla imprimir este trabajo como puesto de impresión? */
export function tocaAqui(t: { tipo: string; destino?: string }, config = leerConfig()) {
  if (t.tipo === "comanda")
    return t.destino === "barra" ? config.estacion.barra : config.estacion.cocina;
  return t.tipo === "ticket" && config.estacion.tickets;
}
