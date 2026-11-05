import "server-only";
import { execFile } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { createConnection } from "node:net";
import os from "node:os";
import path from "node:path";
import { RUTA_PUERTO } from "../dominio/impresoras";
import type { EquipoPuente, Impresora } from "../dominio/tipos";

/**
 * Cómo se manda a cada impresora desde un ordenador del bar (el servidor cuando la app corre en
 * el bar; en la nube hace lo mismo el puente, public/puente-impresion.mjs):
 * - por red, al puerto 9100 de su IP;
 * - a una impresora instalada en el sistema, por su nombre y en bruto («RAW»): en Windows con
 *   la cola de impresión, en Mac y Linux con CUPS (`lp`);
 * - a un puerto (COM3, Bluetooth emparejada, /dev/usb/lp0), escribiendo en él.
 */
export type Salida =
  | { via: "red"; ip: string; puerto: number }
  | { via: "sistema"; nombre: string }
  | { via: "puerto"; ruta: string; baudios: number };

export function salidaDe(i: Impresora): Salida | null {
  if (i.conexion === "red" && i.ip) return { via: "red", ip: i.ip, puerto: i.puerto };
  if (i.conexion === "sistema" && i.nombreSistema)
    return { via: "sistema", nombre: i.nombreSistema };
  if (i.conexion === "puerto" && i.rutaPuerto && RUTA_PUERTO.test(i.rutaPuerto))
    return { via: "puerto", ruta: i.rutaPuerto, baudios: i.baudios ?? 9600 };
  return null;
}

export function enviar(salida: Salida, bytes: Uint8Array): Promise<void> {
  switch (salida.via) {
    case "red":
      return enviarPorRed(salida.ip, salida.puerto, bytes);
    case "sistema":
      return enviarAlSistema(salida.nombre, bytes);
    case "puerto":
      return enviarAPuerto(salida.ruta, salida.baudios, bytes);
  }
}

const ESPERA_MS = 15_000;

/** Por red, al puerto «raw» (9100), como imprimen casi todas las de cocina con cable o wifi. */
export function enviarPorRed(ip: string, puerto: number, bytes: Uint8Array, esperaMs = 6000) {
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: ip, port: puerto });
    const fallo = (mensaje: string) => {
      socket.destroy();
      reject(new Error(mensaje));
    };
    socket.setTimeout(esperaMs, () =>
      fallo(`La impresora ${ip}:${puerto} no contesta. ¿Está encendida y en la misma red?`),
    );
    socket.once("error", (e: NodeJS.ErrnoException) =>
      fallo(
        e.code === "ECONNREFUSED"
          ? `La impresora ${ip}:${puerto} rechaza la conexión. Revisa el puerto.`
          : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH"
            ? `No llego a ${ip}. Revisa la IP de la impresora.`
            : `Error al imprimir: ${e.message}`,
      ),
    );
    socket.once("connect", () => {
      socket.end(Buffer.from(bytes), () => resolve());
    });
  });
}

function ejecutar(orden: string, argumentos: string[], esperaMs = ESPERA_MS) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      orden,
      argumentos,
      { timeout: esperaMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, salida, errores) => {
        if (error) reject(new Error((errores || error.message).toString().trim().slice(0, 300)));
        else resolve(salida.toString());
      },
    );
  });
}

/**
 * Programa de PowerShell que manda bytes en bruto a una impresora de Windows con la API de la
 * cola de impresión (winspool), sin pasar por su driver de dibujo: así llegan los comandos
 * ESC/POS (corte, cajón, QR) tal cual. Los datos entran como parámetros, nunca como código.
 */
export const POWERSHELL_RAW = String.raw`param([string]$Impresora, [string]$Archivo)
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ComandaRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string nombre, out IntPtr h, IntPtr defecto);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr h, int nivel, [In] DOCINFO doc);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] datos, int cuantos, out int escritos);
  public static void Mandar(string nombre, byte[] datos) {
    IntPtr h;
    if (!OpenPrinter(nombre, out h, IntPtr.Zero))
      throw new Exception("No encuentro la impresora «" + nombre + "» en este ordenador.");
    try {
      DOCINFO doc = new DOCINFO();
      doc.pDocName = "Comanda";
      doc.pDataType = "RAW";
      if (StartDocPrinter(h, 1, doc) == 0)
        throw new Exception("La cola de impresión no acepta el trabajo (" + Marshal.GetLastWin32Error() + ").");
      try {
        StartPagePrinter(h);
        int escritos;
        if (!WritePrinter(h, datos, datos.Length, out escritos))
          throw new Exception("No se ha podido escribir en la impresora (" + Marshal.GetLastWin32Error() + ").");
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
[ComandaRaw]::Mandar($Impresora, [System.IO.File]::ReadAllBytes($Archivo))
`;

/** Qué se ejecuta para imprimir en bruto en una impresora del sistema (para probarlo aparte). */
export function ordenSistema(
  nombre: string,
  archivo: string,
  programaPowershell: string,
  plataforma: NodeJS.Platform = process.platform,
): [string, string[]] {
  if (plataforma === "win32")
    return [
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        programaPowershell,
        "-Impresora",
        nombre,
        "-Archivo",
        archivo,
      ],
    ];
  return ["lp", ["-d", nombre, "-o", "raw", archivo]];
}

async function conArchivoTemporal<T>(bytes: Uint8Array, usar: (ruta: string) => Promise<T>) {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "comanda-"));
  const archivo = path.join(carpeta, "trabajo.bin");
  try {
    await fs.writeFile(archivo, bytes);
    return await usar(archivo);
  } finally {
    await fs.rm(carpeta, { recursive: true, force: true });
  }
}

let programaPs: string | null = null;
async function programaPowershell() {
  if (programaPs && existsSync(programaPs)) return programaPs;
  const ruta = path.join(os.tmpdir(), "comanda-imprimir-raw.ps1");
  await fs.writeFile(ruta, POWERSHELL_RAW, "utf8");
  programaPs = ruta;
  return ruta;
}

export async function enviarAlSistema(nombre: string, bytes: Uint8Array) {
  const ps = process.platform === "win32" ? await programaPowershell() : "";
  await conArchivoTemporal(bytes, async (archivo) => {
    const [orden, argumentos] = ordenSistema(nombre, archivo, ps);
    try {
      await ejecutar(orden, argumentos);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      throw new Error(
        /ENOENT|not found|no se reconoce/i.test(mensaje) && process.platform !== "win32"
          ? "Este ordenador no tiene el sistema de impresión (CUPS) para imprimir por nombre."
          : mensaje,
      );
    }
  });
}

/** ¿Es un puerto serie de verdad (al que hay que poner velocidad) o una impresora USB de Linux? */
const esPuertoSerie = (ruta: string) => /^COM\d+$|^\/dev\/(tty|cu\.|rfcomm)/.test(ruta);

export async function enviarAPuerto(ruta: string, baudios: number, bytes: Uint8Array) {
  if (!RUTA_PUERTO.test(ruta)) throw new Error("Ese puerto no vale.");
  if (process.platform === "win32") {
    await ejecutar("mode", [`${ruta}:`, `BAUD=${baudios}`, "PARITY=N", "DATA=8", "STOP=1"]).catch(
      () => {
        // Los puertos Bluetooth no admiten velocidad: se sigue igual.
      },
    );
    return escribirEnPuerto(`\\\\.\\${ruta}`, bytes);
  }
  if (esPuertoSerie(ruta))
    await ejecutar("stty", [
      process.platform === "darwin" ? "-f" : "-F",
      ruta,
      String(baudios),
      "raw",
      "-echo",
    ]).catch(() => {
      // Si no se puede ajustar (Bluetooth, permisos), se intenta escribir igualmente.
    });
  return escribirEnPuerto(ruta, bytes);
}

/** Escribe en el puerto, sin esperar más de la cuenta si el aparato no responde. */
export function escribirEnPuerto(ruta: string, bytes: Uint8Array, esperaMs = ESPERA_MS) {
  return new Promise<void>((resolve, reject) => {
    const reloj = setTimeout(
      () => reject(new Error(`El puerto ${ruta} no responde. ¿Está la impresora encendida?`)),
      esperaMs,
    );
    fs.writeFile(ruta, bytes).then(
      () => {
        clearTimeout(reloj);
        resolve();
      },
      (e: NodeJS.ErrnoException) => {
        clearTimeout(reloj);
        reject(
          new Error(
            e.code === "ENOENT"
              ? `No existe el puerto ${ruta} en este ordenador.`
              : e.code === "EACCES" || e.code === "EPERM"
                ? `Sin permiso para usar ${ruta}.`
                : e.code === "EBUSY"
                  ? `El puerto ${ruta} lo está usando otro programa.`
                  : `Error al imprimir en ${ruta}: ${e.message}`,
          ),
        );
      },
    );
  });
}

/** Lo que tiene este ordenador: impresoras instaladas y puertos. */
export async function equipoLocal(): Promise<Omit<EquipoPuente, "visto" | "version">> {
  const so =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "mac"
        : process.platform === "linux"
          ? "linux"
          : "otro";
  const lineas = (texto: string) =>
    texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  let sistema: string[] = [];
  let puertos: { ruta: string; nombre: string }[] = [];
  if (so === "windows") {
    sistema = await ejecutar("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-Printer | Select-Object -ExpandProperty Name",
    ])
      .then(lineas)
      .catch(() => []);
    puertos = await ejecutar("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | Select-Object -ExpandProperty Name",
    ])
      .then((t) =>
        lineas(t).flatMap((nombre) => {
          const com = /\((COM\d+)\)/.exec(nombre)?.[1];
          return com ? [{ ruta: com, nombre }] : [];
        }),
      )
      .catch(() => []);
  } else {
    sistema = await ejecutar("lpstat", ["-e"])
      .then(lineas)
      .catch(() => []);
    const dev = await fs.readdir("/dev").catch(() => [] as string[]);
    puertos = dev
      .filter(
        (n) =>
          /^(ttyUSB|ttyACM|rfcomm)\d+$/.test(n) ||
          (n.startsWith("cu.") && !/Bluetooth-Incoming-Port|debug-console/.test(n)),
      )
      .map((n) => ({ ruta: `/dev/${n}`, nombre: n }));
    const usb = await fs.readdir("/dev/usb").catch(() => [] as string[]);
    puertos.push(
      ...usb
        .filter((n) => /^lp\d+$/.test(n))
        .map((n) => ({ ruta: `/dev/usb/${n}`, nombre: `Impresora USB (${n})` })),
    );
  }
  return { so, sistema, puertos };
}
