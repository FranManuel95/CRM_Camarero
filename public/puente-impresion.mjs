#!/usr/bin/env node
// Puente de impresión de Comanda (versión 2).
//
// Se deja funcionando en un ordenador del bar (el de la caja, un mini-PC o una Raspberry Pi) y
// manda a las impresoras lo que hay que imprimir:
//   - por red (cable o wifi), a la IP de la impresora;
//   - a una impresora instalada en el ordenador (USB, Bluetooth…), por su nombre;
//   - a un puerto (COM3, Bluetooth emparejada, /dev/usb/lp0).
// Se entera al momento de lo nuevo (sin preguntar sin parar) y cuenta qué impresoras y puertos
// ve, para elegirlos de una lista en Gestión → Impresoras.
//
// Necesita Node.js 18 o más nuevo (nodejs.org). No hay que instalar nada más.
//
//   node puente-impresion.mjs instalar https://tu-comanda.vercel.app CLAVE   (arranca solo siempre)
//   node puente-impresion.mjs https://tu-comanda.vercel.app CLAVE            (solo esta vez)
//   node puente-impresion.mjs listar                                         (qué impresoras veo)
//   node puente-impresion.mjs desinstalar
//
// La clave sale en Gestión → Impresoras.

import { execFile, spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { createConnection } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const VERSION = "2";
const ESPERA_MS = 15_000;

const hora = () => new Date().toLocaleTimeString("es-ES");
const decir = (texto) => console.log(`${hora()}  ${texto}`);
const quejarse = (texto) => console.error(`${hora()}  ${texto}`);

// ---------------------------------------------------------------------------------------------
// Cómo se manda a cada impresora (lo mismo que hace el servidor en src/lib/servidor/salidas.ts).

export const RUTA_PUERTO = /^(?:COM[1-9]\d{0,2}|\/dev\/(?!.*\.\.)[\w.\-/]{1,60})$/;

export function enviarPorRed(ip, puerto, bytes, esperaMs = 6000) {
  return new Promise((resolve, reject) => {
    const s = createConnection({ host: ip, port: puerto });
    const fallo = (mensaje) => {
      s.destroy();
      reject(new Error(mensaje));
    };
    s.setTimeout(esperaMs, () => fallo(`La impresora ${ip}:${puerto} no contesta`));
    s.once("error", (e) => fallo(`${ip}:${puerto}: ${e.message}`));
    s.once("connect", () => s.end(Buffer.from(bytes), () => resolve()));
  });
}

function ejecutar(orden, argumentos, esperaMs = ESPERA_MS) {
  return new Promise((resolve, reject) => {
    execFile(
      orden,
      argumentos,
      { timeout: esperaMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, salida, errores) => {
        if (error)
          reject(
            new Error(
              String(errores || error.message)
                .trim()
                .slice(0, 300),
            ),
          );
        else resolve(String(salida));
      },
    );
  });
}

// Manda bytes en bruto a una impresora de Windows por la cola de impresión (winspool), sin pasar
// por su driver de dibujo: así llegan los comandos ESC/POS (corte, cajón, QR) tal cual.
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

export function ordenSistema(nombre, archivo, programaPowershell, plataforma = process.platform) {
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

let programaPs = null;
async function programaPowershell() {
  if (programaPs && existsSync(programaPs)) return programaPs;
  programaPs = path.join(os.tmpdir(), "comanda-imprimir-raw.ps1");
  await fs.writeFile(programaPs, POWERSHELL_RAW, "utf8");
  return programaPs;
}

export async function enviarAlSistema(nombre, bytes) {
  const ps = process.platform === "win32" ? await programaPowershell() : "";
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "comanda-"));
  const archivo = path.join(carpeta, "trabajo.bin");
  try {
    await fs.writeFile(archivo, bytes);
    const [orden, argumentos] = ordenSistema(nombre, archivo, ps);
    await ejecutar(orden, argumentos);
  } finally {
    await fs.rm(carpeta, { recursive: true, force: true });
  }
}

export function escribirEnPuerto(ruta, bytes, esperaMs = ESPERA_MS) {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`El puerto ${ruta} no responde`)), esperaMs);
    fs.writeFile(ruta, bytes).then(
      () => {
        clearTimeout(reloj);
        resolve();
      },
      (e) => {
        clearTimeout(reloj);
        reject(
          new Error(
            e.code === "ENOENT"
              ? `No existe el puerto ${ruta} en este ordenador`
              : e.code === "EBUSY"
                ? `El puerto ${ruta} lo está usando otro programa`
                : `${ruta}: ${e.message}`,
          ),
        );
      },
    );
  });
}

export async function enviarAPuerto(ruta, baudios, bytes) {
  if (!RUTA_PUERTO.test(ruta)) throw new Error(`El puerto «${ruta}» no vale`);
  if (process.platform === "win32") {
    await ejecutar("mode", [`${ruta}:`, `BAUD=${baudios}`, "PARITY=N", "DATA=8", "STOP=1"]).catch(
      () => {},
    );
    return escribirEnPuerto(`\\\\.\\${ruta}`, bytes);
  }
  if (/^\/dev\/(tty|cu\.|rfcomm)/.test(ruta))
    await ejecutar("stty", [
      process.platform === "darwin" ? "-f" : "-F",
      ruta,
      String(baudios),
      "raw",
      "-echo",
    ]).catch(() => {});
  return escribirEnPuerto(ruta, bytes);
}

export function enviar(salida, bytes) {
  if (salida.via === "red") return enviarPorRed(salida.ip, salida.puerto, bytes);
  if (salida.via === "sistema") return enviarAlSistema(salida.nombre, bytes);
  if (salida.via === "puerto") return enviarAPuerto(salida.ruta, salida.baudios ?? 9600, bytes);
  return Promise.reject(new Error("No sé imprimir en esa impresora: actualiza el puente"));
}

/** Impresoras instaladas y puertos de este ordenador. */
export async function equipo() {
  const so =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "mac"
        : process.platform === "linux"
          ? "linux"
          : "otro";
  const lineas = (t) =>
    t
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  let sistema = [];
  let puertos = [];
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
    const dev = await fs.readdir("/dev").catch(() => []);
    puertos = dev
      .filter(
        (n) =>
          /^(ttyUSB|ttyACM|rfcomm)\d+$/.test(n) ||
          (n.startsWith("cu.") && !/Bluetooth-Incoming-Port|debug-console/.test(n)),
      )
      .map((n) => ({ ruta: `/dev/${n}`, nombre: n }));
    const usb = await fs.readdir("/dev/usb").catch(() => []);
    for (const n of usb)
      if (/^lp\d+$/.test(n))
        puertos.push({ ruta: `/dev/usb/${n}`, nombre: `Impresora USB (${n})` });
  }
  return { so, sistema: sistema.slice(0, 50), puertos: puertos.slice(0, 50) };
}

// ---------------------------------------------------------------------------------------------
// Hablar con la app.

export function crearPuente(direccion, clave, { usarDirecto = true } = {}) {
  const api = new URL("/api/puente", direccion).toString();
  const cabeceras = {
    Authorization: `Bearer ${clave}`,
    "Content-Type": "application/json",
    "X-Puente": VERSION,
  };
  let ocupado = false;
  let otraVez = false;
  let sinConexion = false;
  let directo = null;
  let enDirecto = false;
  let avisadoVersion = false;

  async function contar(resultado) {
    await fetch(api, { method: "POST", headers: cabeceras, body: JSON.stringify(resultado) });
  }

  /** Pregunta qué hay que imprimir y lo imprime, en orden y de uno en uno. */
  async function vuelta() {
    if (ocupado) {
      otraVez = true;
      return;
    }
    ocupado = true;
    try {
      const r = await fetch(api, { headers: cabeceras });
      if (r.status === 401) {
        quejarse("La clave del puente no vale. Cópiala otra vez de Gestión → Impresoras.");
        process.exitCode = 1;
        detener();
        return;
      }
      const respuesta = await r.json();
      if (sinConexion) decir("Conexión recuperada.");
      sinConexion = false;
      if (respuesta.version && respuesta.version !== VERSION && !avisadoVersion) {
        avisadoVersion = true;
        decir("Hay una versión nueva del puente: descárgala en Gestión → Impresoras.");
      }
      if (usarDirecto && respuesta.directo && !directo) escucharCambios(respuesta.directo);
      for (const t of respuesta.trabajos ?? []) {
        const salida = t.salida ?? { via: "red", ip: t.ip, puerto: t.puerto };
        try {
          await enviar(salida, Buffer.from(t.datos, "base64"));
          decir(`✓ ${t.titulo} → ${t.impresora}`);
          await contar({ id: t.id, ok: true });
        } catch (e) {
          quejarse(`✗ ${t.titulo} → ${t.impresora}: ${e.message}`);
          await contar({ id: t.id, ok: false, error: String(e.message).slice(0, 290) });
        }
      }
    } catch (e) {
      if (!sinConexion) quejarse(`Sin conexión con ${direccion} (${e.message}). Reintentando…`);
      sinConexion = true;
    } finally {
      ocupado = false;
      if (otraVez) {
        otraVez = false;
        void vuelta();
      }
    }
  }

  /** Cuenta qué impresoras y puertos hay aquí, y que el puente sigue en marcha. */
  async function latido() {
    try {
      await contar({ latido: { version: VERSION, ...(await equipo()) } });
    } catch {
      // Sin conexión: ya se avisa en la vuelta.
    }
  }

  /**
   * Avisos en directo (Supabase Realtime): cuando cambia algo en el bar, se pregunta enseguida.
   * Si el navegador de Node no tiene WebSocket, se sigue preguntando a menudo.
   */
  function escucharCambios(config) {
    if (typeof WebSocket === "undefined") return;
    directo = config;
    let ref = 0;
    let latidoWs = null;
    const conectar = () => {
      const url = `${config.url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(config.clave)}&vsn=1.0.0`;
      const ws = new WebSocket(url);
      const tema = `realtime:${config.canal}`;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            topic: tema,
            event: "phx_join",
            payload: {
              config: { broadcast: { self: false }, presence: { key: "" }, private: false },
            },
            ref: String(++ref),
          }),
        );
        latidoWs = setInterval(
          () =>
            ws.send(
              JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: String(++ref),
              }),
            ),
          25_000,
        );
      };
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data));
          if (msg.topic === tema && msg.event === "phx_reply" && msg.payload?.status === "ok") {
            if (!enDirecto) decir("Escuchando en directo: lo nuevo se imprime al momento.");
            enDirecto = true;
          }
          if (msg.topic === tema && msg.event === "broadcast") void vuelta();
        } catch {
          // mensaje raro: se ignora
        }
      };
      ws.onclose = () => {
        clearInterval(latidoWs);
        enDirecto = false;
        if (!parado) setTimeout(conectar, 5_000);
      };
      ws.onerror = () => ws.close();
      cerrarWs = () => ws.close();
    };
    conectar();
  }

  let parado = false;
  let cerrarWs = () => {};
  const relojes = [];
  function detener() {
    parado = true;
    relojes.forEach(clearInterval);
    cerrarWs();
  }

  function arrancar() {
    decir(`Puente de impresión ${VERSION} en marcha. Déjalo abierto.`);
    void vuelta();
    void latido();
    // Con avisos en directo basta con repasar de vez en cuando; sin ellos, se pregunta a menudo.
    relojes.push(setInterval(() => void (enDirecto ? null : vuelta()), 2_000));
    relojes.push(setInterval(() => void vuelta(), 30_000));
    relojes.push(setInterval(() => void latido(), 60_000));
  }

  return { arrancar, detener, vuelta, latido };
}

// ---------------------------------------------------------------------------------------------
// Instalar para que arranque solo al encender el ordenador.

const carpetaInstalada = () =>
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA ?? os.homedir(), "ComandaPuente")
    : path.join(os.homedir(), ".comanda-puente");

async function instalar(direccion, clave) {
  const carpeta = carpetaInstalada();
  await fs.mkdir(carpeta, { recursive: true });
  const script = path.join(carpeta, "puente-impresion.mjs");
  await fs.copyFile(fileURLToPath(import.meta.url), script);
  const node = process.execPath;

  if (process.platform === "win32") {
    const inicio = path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
    );
    const cmd = path.join(inicio, "Comanda - puente de impresion.cmd");
    await fs.writeFile(
      cmd,
      [
        "@echo off",
        'if not "%~1"=="min" (start "Comanda - puente de impresion" /min "%~f0" min & exit /b)',
        `"${node}" "${script}" ${direccion} ${clave}`,
        "",
      ].join("\r\n"),
    );
    // La orden tal cual (sin que Node la vuelva a entrecomillar): cmd.exe es muy suyo.
    spawn("cmd.exe", ["/c", `start "" /min "${cmd}"`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      windowsVerbatimArguments: true,
    }).unref();
    decir("Instalado. Arranca solo al encender el ordenador (minimizado en la barra de tareas).");
    decir(`Para quitarlo: node "${script}" desinstalar`);
    return;
  }

  if (process.platform === "darwin") {
    const plist = path.join(os.homedir(), "Library", "LaunchAgents", "es.comanda.puente.plist");
    const registro = path.join(os.homedir(), "Library", "Logs", "comanda-puente.log");
    await fs.mkdir(path.dirname(plist), { recursive: true });
    await fs.writeFile(
      plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>es.comanda.puente</string>
  <key>ProgramArguments</key><array>
    <string>${node}</string><string>${script}</string><string>${direccion}</string><string>${clave}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${registro}</string>
  <key>StandardErrorPath</key><string>${registro}</string>
</dict></plist>
`,
    );
    await ejecutar("launchctl", ["unload", plist]).catch(() => {});
    await ejecutar("launchctl", ["load", "-w", plist]);
    decir(`Instalado. Arranca solo al encender el Mac. Lo que hace queda en ${registro}`);
    return;
  }

  const unidad = path.join(os.homedir(), ".config", "systemd", "user", "comanda-puente.service");
  await fs.mkdir(path.dirname(unidad), { recursive: true });
  await fs.writeFile(
    unidad,
    `[Unit]
Description=Comanda - puente de impresion
After=network-online.target

[Service]
ExecStart="${node}" "${script}" ${direccion} ${clave}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`,
  );
  try {
    await ejecutar("systemctl", ["--user", "daemon-reload"]);
    await ejecutar("systemctl", ["--user", "enable", "--now", "comanda-puente.service"]);
    decir("Instalado como servicio. Para que arranque sin iniciar sesión: loginctl enable-linger");
  } catch (e) {
    quejarse(`No se ha podido activar el servicio (${e.message}). Arráncalo a mano con:`);
    quejarse(`"${node}" "${script}" ${direccion} ${clave}`);
  }
}

async function desinstalar() {
  if (process.platform === "win32") {
    await fs
      .rm(
        path.join(
          process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
          "Microsoft",
          "Windows",
          "Start Menu",
          "Programs",
          "Startup",
          "Comanda - puente de impresion.cmd",
        ),
        { force: true },
      )
      .catch(() => {});
  } else if (process.platform === "darwin") {
    const plist = path.join(os.homedir(), "Library", "LaunchAgents", "es.comanda.puente.plist");
    await ejecutar("launchctl", ["unload", plist]).catch(() => {});
    await fs.rm(plist, { force: true });
  } else {
    await ejecutar("systemctl", ["--user", "disable", "--now", "comanda-puente.service"]).catch(
      () => {},
    );
    await fs.rm(path.join(os.homedir(), ".config", "systemd", "user", "comanda-puente.service"), {
      force: true,
    });
  }
  decir("Quitado: ya no arranca solo. (Si hay uno abierto ahora, ciérralo.)");
}

// ---------------------------------------------------------------------------------------------

function uso() {
  console.log(`Uso:
  node puente-impresion.mjs instalar https://tu-comanda.vercel.app CLAVE   (arranca solo siempre)
  node puente-impresion.mjs https://tu-comanda.vercel.app CLAVE            (solo esta vez)
  node puente-impresion.mjs listar                                         (impresoras y puertos)
  node puente-impresion.mjs desinstalar
La clave sale en Gestión → Impresoras.`);
}

function comprobar(direccion, clave) {
  if (!/^https?:\/\/[^\s]+$/.test(direccion ?? "") || !clave) {
    uso();
    process.exit(1);
  }
}

async function principal(argumentos) {
  const [orden, ...resto] = argumentos;
  if (orden === "listar") {
    const e = await equipo();
    console.log("Impresoras instaladas:", e.sistema.length ? "" : "(ninguna)");
    for (const n of e.sistema) console.log(`  · ${n}`);
    console.log("Puertos:", e.puertos.length ? "" : "(ninguno)");
    for (const p of e.puertos) console.log(`  · ${p.ruta}  ${p.nombre}`);
    return;
  }
  if (orden === "desinstalar") return desinstalar();
  if (orden === "instalar") {
    comprobar(resto[0], resto[1]);
    return instalar(resto[0], resto[1]);
  }
  comprobar(orden, resto[0]);
  crearPuente(orden, resto[0]).arrancar();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  principal(process.argv.slice(2)).catch((e) => {
    quejarse(e.message);
    process.exit(1);
  });
