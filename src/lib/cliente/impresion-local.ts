"use client";

import type { RespuestaAccion } from "./api";

/**
 * Impresión desde esta pantalla, para las impresoras conectadas a ella (las de conexión
 * «navegador»): cada pantalla dice qué impresoras tiene al lado y cómo les habla.
 * - **usb**: bytes ESC/POS directos por USB (WebUSB). Sin diálogo y abre el cajón. Va bien en
 *   Android, Mac, Linux y ChromeOS; en Windows suele chocar con su driver (mejor el puente).
 * - **bluetooth**: impresoras Bluetooth de bajo consumo (Web Bluetooth), las típicas de 58 mm.
 * - **serie**: puertos serie y Bluetooth clásico ya emparejado (Web Serial): Windows, Mac y
 *   Linux con Chrome o Edge, y Android con Chrome 138 o más nuevo.
 * - **dialogo**: el diálogo de imprimir del sistema, para cualquier impresora con su driver.
 * Todo esto solo en Chrome o Edge, y con la app abierta por https (o en localhost).
 */
export type ViaPantalla = "dialogo" | "usb" | "bluetooth" | "serie";

/** Cómo encontrar otra vez el aparato al recargar (sin volver a pedir permiso si se puede). */
export type EnlaceImpresora = {
  via: ViaPantalla;
  /** Nombre del aparato, para enseñarlo. */
  aparato?: string;
  usb?: { vendorId: number; productId: number; serialNumber?: string };
  serie?: { usbVendorId?: number; usbProductId?: number; bluetooth?: string; baudios: number };
  bluetooth?: { id: string };
};

export type ConfigImpresion = {
  /** Las impresoras conectadas a esta pantalla, por su id. */
  impresoras: Record<string, EnlaceImpresora>;
  /**
   * Para bares sin impresoras dadas de alta (lo de antes): cómo imprime esta pantalla y qué
   * trabajos le tocan como puesto de impresión.
   */
  metodo: "navegador" | "usb" | "ninguno";
  columnas: number;
  estacion: { cocina: boolean; barra: boolean; tickets: boolean };
};

export const CLAVE_CONFIG = "comanda.impresion";
export const CONFIG_POR_DEFECTO: ConfigImpresion = {
  impresoras: {},
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

// --- Tipos mínimos de WebUSB, Web Bluetooth y Web Serial (no todos los navegadores los tienen) ---

type Endpoint = { direction: "in" | "out"; type: string; endpointNumber: number };
type Interfaz = { interfaceNumber: number; alternate: { endpoints: Endpoint[] } };
type DispositivoUsb = {
  productName?: string;
  vendorId: number;
  productId: number;
  serialNumber?: string;
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

type Caracteristica = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse?(d: BufferSource): Promise<void>;
  writeValueWithoutResponse?(d: BufferSource): Promise<void>;
  writeValue(d: BufferSource): Promise<void>;
};
type ServicioBle = { getCharacteristics(): Promise<Caracteristica[]> };
type AparatoBle = {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryServices(): Promise<ServicioBle[]> }>;
  };
};
type Bluetooth = {
  requestDevice(o: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<AparatoBle>;
  getDevices?(): Promise<AparatoBle[]>;
};

type PuertoSerie = {
  readable: unknown;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: string };
  open(o: { baudRate: number }): Promise<void>;
};
type Serie = { requestPort(o?: object): Promise<PuertoSerie>; getPorts(): Promise<PuertoSerie[]> };

const nav = () =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { usb?: Usb; bluetooth?: Bluetooth; serial?: Serie });

export type Capacidades = { usb: boolean; bluetooth: boolean; serie: boolean; windows: boolean };

/** Lo que se supone en el servidor (y antes de mirar el navegador): solo el diálogo. */
export const SIN_CAPACIDADES: Capacidades = {
  usb: false,
  bluetooth: false,
  serie: false,
  windows: false,
};

let capacidadesVistas: Capacidades | null = null;

/**
 * Qué sabe hacer este navegador (en un sitio seguro: https o localhost). Siempre el mismo
 * objeto: React lo lee como dato externo y un objeto nuevo en cada lectura lo haría repintar sin fin.
 */
export function capacidades(): Capacidades {
  if (capacidadesVistas) return capacidadesVistas;
  const n = nav();
  if (typeof window === "undefined" || !n) return SIN_CAPACIDADES;
  const seguro = window.isSecureContext;
  capacidadesVistas = {
    usb: Boolean(seguro && n.usb),
    bluetooth: Boolean(seguro && n.bluetooth),
    serie: Boolean(seguro && n.serial),
    windows: /Windows/i.test(navigator.userAgent),
  };
  return capacidadesVistas;
}
/** Para lo de antes: ¿hay WebUSB? */
export const hayWebUsb = () => capacidades().usb;

// --- USB ---

const abiertosUsb = new Map<string, { dispositivo: DispositivoUsb; endpoint: number }>();

async function abrirUsb(dispositivo: DispositivoUsb) {
  if (!dispositivo.opened) await dispositivo.open();
  if (!dispositivo.configuration) await dispositivo.selectConfiguration(1);
  for (const interfaz of dispositivo.configuration?.interfaces ?? []) {
    const salida = interfaz.alternate.endpoints.find(
      (e) => e.direction === "out" && e.type === "bulk",
    );
    if (salida) {
      try {
        await dispositivo.claimInterface(interfaz.interfaceNumber);
      } catch {
        throw new Error(
          capacidades().windows
            ? "Windows tiene la impresora cogida con su driver. Usa «En un ordenador del bar» con el puente."
            : "La impresora USB está ocupada (¿abierta en otra pestaña?).",
        );
      }
      return { dispositivo, endpoint: salida.endpointNumber };
    }
  }
  throw new Error("Este aparato USB no parece una impresora.");
}

// --- Bluetooth de bajo consumo ---

/**
 * Servicios donde suelen escuchar las impresoras Bluetooth de tickets (las chinas de 58 y
 * 80 mm, Goojprt, MTP, Phomemo…). Web Bluetooth solo deja usar los que se nombran aquí.
 */
const SERVICIOS_BLE = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];
/** Trozos pequeños: lo que cabe seguro en un paquete Bluetooth sin negociar más. */
const TROZO_BLE = 20;

const abiertosBle = new Map<string, Caracteristica>();

async function caracteristicaDe(aparato: AparatoBle): Promise<Caracteristica> {
  if (!aparato.gatt) throw new Error("Esta impresora Bluetooth no deja conectarse.");
  const servidor = await aparato.gatt.connect();
  for (const servicio of await servidor.getPrimaryServices().catch(() => [])) {
    for (const c of await servicio.getCharacteristics().catch(() => []))
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
  }
  throw new Error(
    "Esta impresora Bluetooth no es de las de bajo consumo. Emparéjala en el sistema y usa «Puerto serie».",
  );
}

async function escribirBle(c: Caracteristica, bytes: Uint8Array<ArrayBuffer>) {
  for (let i = 0; i < bytes.length; i += TROZO_BLE) {
    const trozo = bytes.slice(i, i + TROZO_BLE);
    if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse)
      await c.writeValueWithoutResponse(trozo);
    else if (c.writeValueWithResponse) await c.writeValueWithResponse(trozo);
    else await c.writeValue(trozo);
  }
}

// --- Puerto serie (USB-serie, Bluetooth clásico emparejado) ---

const abiertosSerie = new Map<string, PuertoSerie>();

async function abrirSerie(puerto: PuertoSerie, baudios: number) {
  if (!puerto.writable) await puerto.open({ baudRate: baudios });
  return puerto;
}

async function escribirSerie(puerto: PuertoSerie, bytes: Uint8Array<ArrayBuffer>) {
  if (!puerto.writable) throw new Error("El puerto serie está cerrado.");
  const escritor = puerto.writable.getWriter();
  try {
    await escritor.write(bytes);
  } finally {
    escritor.releaseLock();
  }
}

// --- Elegir y recordar el aparato ---

/**
 * Pide permiso para usar una impresora por USB, Bluetooth o puerto serie (tiene que ser al
 * pulsar un botón) y la deja lista. Devuelve cómo encontrarla otra vez.
 */
export async function enlazar(
  impresoraId: string,
  via: Exclude<ViaPantalla, "dialogo">,
  baudios = 9600,
): Promise<EnlaceImpresora> {
  const n = nav();
  if (via === "usb") {
    if (!n?.usb) throw new Error("Este navegador no puede usar USB. Prueba con Chrome o Edge.");
    const dispositivo = await n.usb.requestDevice({ filters: [] });
    abiertosUsb.set(impresoraId, await abrirUsb(dispositivo));
    return {
      via,
      aparato: dispositivo.productName ?? "Impresora USB",
      usb: {
        vendorId: dispositivo.vendorId,
        productId: dispositivo.productId,
        ...(dispositivo.serialNumber ? { serialNumber: dispositivo.serialNumber } : {}),
      },
    };
  }
  if (via === "bluetooth") {
    if (!n?.bluetooth)
      throw new Error("Este navegador no puede usar Bluetooth. Prueba con Chrome en Android.");
    const aparato = await n.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICIOS_BLE,
    });
    abiertosBle.set(impresoraId, await caracteristicaDe(aparato));
    return { via, aparato: aparato.name ?? "Impresora Bluetooth", bluetooth: { id: aparato.id } };
  }
  if (!n?.serial) throw new Error("Este navegador no puede usar puertos serie. Prueba con Chrome.");
  const puerto = await n.serial.requestPort();
  abiertosSerie.set(impresoraId, await abrirSerie(puerto, baudios));
  const info = puerto.getInfo();
  return {
    via,
    aparato: info.bluetoothServiceClassId ? "Impresora Bluetooth (puerto)" : "Puerto serie",
    serie: {
      baudios,
      ...(info.usbVendorId ? { usbVendorId: info.usbVendorId } : {}),
      ...(info.usbProductId ? { usbProductId: info.usbProductId } : {}),
      ...(info.bluetoothServiceClassId ? { bluetooth: info.bluetoothServiceClassId } : {}),
    },
  };
}

/** ¿Está la impresora lista en esta pantalla, sin tener que pedir permiso otra vez? */
export async function estaLista(impresoraId: string, enlace: EnlaceImpresora): Promise<boolean> {
  try {
    await abrirEnlace(impresoraId, enlace);
    return true;
  } catch {
    return false;
  }
}

/** Abre el aparato recordado (los permisos de USB y puerto serie duran; los de Bluetooth no siempre). */
async function abrirEnlace(impresoraId: string, enlace: EnlaceImpresora) {
  const n = nav();
  if (enlace.via === "usb") {
    if (abiertosUsb.has(impresoraId)) return;
    const d = (await n?.usb?.getDevices())?.find(
      (x) =>
        x.vendorId === enlace.usb?.vendorId &&
        x.productId === enlace.usb?.productId &&
        (!enlace.usb?.serialNumber || x.serialNumber === enlace.usb.serialNumber),
    );
    if (!d) throw new Error("No encuentro la impresora USB: ¿está enchufada y encendida?");
    abiertosUsb.set(impresoraId, await abrirUsb(d));
  } else if (enlace.via === "bluetooth") {
    if (abiertosBle.has(impresoraId)) return;
    const aparato = (await n?.bluetooth?.getDevices?.())?.find(
      (x) => x.id === enlace.bluetooth?.id,
    );
    if (!aparato) throw new Error(`Toca «Conectar» para volver a enlazar ${enlace.aparato ?? ""}.`);
    abiertosBle.set(impresoraId, await caracteristicaDe(aparato));
  } else if (enlace.via === "serie") {
    if (abiertosSerie.has(impresoraId)) return;
    const s = enlace.serie;
    const puerto = (await n?.serial?.getPorts())?.find((p) => {
      const info = p.getInfo();
      return s?.bluetooth
        ? info.bluetoothServiceClassId === s.bluetooth
        : info.usbVendorId === s?.usbVendorId && info.usbProductId === s?.usbProductId;
    });
    if (!puerto) throw new Error("No encuentro el puerto de la impresora: ¿está conectada?");
    abiertosSerie.set(impresoraId, await abrirSerie(puerto, s?.baudios ?? 9600));
  }
}

/** Manda los bytes a la impresora enlazada en esta pantalla. */
export async function enviarDirecto(
  impresoraId: string,
  enlace: EnlaceImpresora,
  bytes: Uint8Array<ArrayBuffer>,
) {
  await abrirEnlace(impresoraId, enlace);
  try {
    if (enlace.via === "usb") {
      const u = abiertosUsb.get(impresoraId)!;
      await u.dispositivo.transferOut(u.endpoint, bytes);
    } else if (enlace.via === "bluetooth") await escribirBle(abiertosBle.get(impresoraId)!, bytes);
    else if (enlace.via === "serie") await escribirSerie(abiertosSerie.get(impresoraId)!, bytes);
  } catch (e) {
    // Si se ha desconectado, la próxima vez se vuelve a abrir.
    abiertosUsb.delete(impresoraId);
    abiertosBle.delete(impresoraId);
    abiertosSerie.delete(impresoraId);
    throw e;
  }
}

/** Para lo de antes (bares sin impresoras dadas de alta): la primera USB con permiso. */
async function enviarUsbSinImpresora(bytes: Uint8Array<ArrayBuffer>) {
  const clave = "_pantalla";
  if (!abiertosUsb.has(clave)) {
    const [previo] = (await nav()?.usb?.getDevices()) ?? [];
    if (!previo) throw new Error("No hay impresora USB conectada a esta pantalla.");
    abiertosUsb.set(clave, await abrirUsb(previo));
  }
  const u = abiertosUsb.get(clave)!;
  await u.dispositivo.transferOut(u.endpoint, bytes);
}

/** Pide permiso para la impresora USB de esta pantalla (lo de antes, sin impresoras). */
export async function conectarUsb(): Promise<string> {
  const n = nav();
  if (!n?.usb) throw new Error("Este navegador no puede usar USB. Prueba con Chrome o Edge.");
  const d = await n.usb.requestDevice({ filters: [] });
  abiertosUsb.set("_pantalla", await abrirUsb(d));
  return d.productName ?? "Impresora USB";
}

// --- Imprimir ---

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

async function bytesDe(id: string, columnas: number) {
  const r = await fetch(`/api/trabajos/${id}?columnas=${columnas}`);
  if (!r.ok) throw new Error("Ese trabajo ya no está en la cola.");
  return new Uint8Array(await r.arrayBuffer());
}

/** Cuenta al servidor cómo ha ido (así sale en Gestión → Impresoras y se puede reintentar). */
async function contar(id: string, error?: string) {
  await fetch(`/api/trabajos/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(error ? { ok: false, error: error.slice(0, 290) } : { ok: true }),
  }).catch(() => {});
}

const yaImpresos = new Set<string>();

/**
 * Imprime un trabajo en esta pantalla: por la impresora enlazada aquí si la hay, o como antes
 * (diálogo o USB) si el trabajo no es de ninguna impresora concreta.
 */
export async function imprimirUno(
  id: string,
  { impresoraId, columnas }: { impresoraId?: string | null; columnas?: number } = {},
  config = leerConfig(),
) {
  if (yaImpresos.has(id)) return;
  yaImpresos.add(id);
  const enlace = impresoraId ? config.impresoras[impresoraId] : undefined;
  const ancho = columnas ?? config.columnas;
  try {
    if (enlace && enlace.via !== "dialogo")
      await enviarDirecto(impresoraId!, enlace, await bytesDe(id, ancho));
    else if (!enlace && config.metodo === "usb")
      await enviarUsbSinImpresora(await bytesDe(id, ancho));
    else if (enlace || config.metodo === "navegador") imprimirEnNavegador(id, ancho);
    else return;
    await contar(id);
  } catch (e) {
    // Que se pueda volver a intentar desde aquí, y que en Gestión se vea el error.
    yaImpresos.delete(id);
    const mensaje = e instanceof Error ? e.message : String(e);
    await contar(id, mensaje);
    throw new Error(mensaje);
  }
}

type TrabajoEnCola = {
  id: string;
  tipo: string;
  estado: string;
  destino?: string;
  impresoraId?: string | null;
};

/** ¿Le toca a esta pantalla imprimir este trabajo? */
export function tocaAqui(t: TrabajoEnCola, config = leerConfig()) {
  if (t.impresoraId) return Boolean(config.impresoras[t.impresoraId]);
  if (t.tipo === "comanda")
    return t.destino === "barra" ? config.estacion.barra : config.estacion.cocina;
  return t.tipo === "ticket" && config.estacion.tickets;
}

/**
 * Tras una acción hecha en esta pantalla: imprime aquí lo suyo. Lo de una impresora conectada a
 * otra pantalla lo imprime esa pantalla; sin impresora concreta, aquí salen los tickets (las
 * comandas son para el puesto de cocina o barra, si lo hay).
 */
export function imprimirTrabajos(
  trabajos: NonNullable<RespuestaAccion["trabajos"]>,
  alFallar: (mensaje: string) => void,
  columnasDe: (impresoraId: string | null | undefined) => number | undefined = () => undefined,
) {
  const config = leerConfig();
  for (const t of trabajos) {
    if (t.estado !== "en_navegador") continue;
    if (t.impresoraId ? !config.impresoras[t.impresoraId] : t.tipo === "comanda") continue;
    imprimirUno(
      t.id,
      { impresoraId: t.impresoraId, columnas: columnasDe(t.impresoraId) },
      config,
    ).catch((e: Error) => alFallar(e.message));
  }
}
