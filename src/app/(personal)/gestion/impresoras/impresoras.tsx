"use client";

import clsx from "clsx";
import { Eye, Pencil, Plus, Printer, RotateCw, Usb } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Papel } from "@/components/papel";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor, Vacio } from "@/components/ui";
import type { Impresora, TrabajoImpresion } from "@/lib/dominio/tipos";
import { formatearHora } from "@/lib/fechas";
import {
  type ConfigImpresion,
  CLAVE_CONFIG,
  CONFIG_POR_DEFECTO,
  conectarUsb,
  hayWebUsb,
  imprimirUno,
  leerConfig,
} from "@/lib/cliente/impresion-local";
import { useDelNavegador, useGuardado } from "@/lib/cliente/use-guardado";

type Borrador = Omit<Impresora, "id"> & { id?: string };

const ESTADO_TRABAJO = {
  pendiente: "Imprimiendo…",
  impreso: "Impreso",
  error: "Error",
  en_navegador: "Para imprimir desde una pantalla",
} as const;

export function Impresoras({ puente }: { puente: { clave: string } | null }) {
  const { estado, hacer, avisar } = useDatos();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [viendo, setViendo] = useState<TrabajoImpresion | null>(null);
  const trabajos = [...estado.trabajos].reverse().slice(0, 40);

  return (
    <main className="space-y-8">
      <section aria-labelledby="t-imp">
        <div className="mb-3 flex items-center justify-between">
          <h1 id="t-imp" className="font-rotulo text-4xl font-bold">
            Impresoras
          </h1>
          <Boton
            variante="primario"
            onClick={() =>
              setBorrador({
                nombre: "",
                conexion: "red",
                ip: "",
                puerto: 9100,
                columnas: 48,
                imprimeCocina: true,
                imprimeBarra: false,
                imprimeTickets: false,
                abreCajon: false,
                activa: true,
              })
            }
          >
            <Plus aria-hidden className="size-4" /> Añadir impresora
          </Boton>
        </div>
        <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
          {estado.impresoras.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Printer aria-hidden className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 basis-48">
                <span className="block font-semibold">
                  {i.nombre}{" "}
                  {!i.activa && (
                    <span className="text-sm font-normal text-tinta-suave">(apagada)</span>
                  )}
                </span>
                <span className="block text-sm text-tinta-suave">
                  {i.conexion === "red"
                    ? `Red · ${i.ip}:${i.puerto}`
                    : "Desde el navegador de una pantalla"}{" "}
                  · {i.columnas === 32 ? "58 mm" : "80 mm"} ·{" "}
                  {[
                    i.imprimeCocina && "cocina",
                    i.imprimeBarra && "barra",
                    i.imprimeTickets && "tickets",
                  ]
                    .filter(Boolean)
                    .join(", ") || "nada asignado"}
                  {i.abreCajon && " · abre el cajón"}
                </span>
              </span>
              <Boton
                tamano="pequeno"
                onClick={() =>
                  hacer({ tipo: "imprimir_prueba", impresoraId: i.id }, "Prueba mandada")
                }
              >
                Imprimir prueba
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Editar ${i.nombre}`}
                onClick={() => setBorrador(i)}
              >
                <Pencil aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
        <details className="mt-3 rounded-xl bg-white p-4 text-sm ring-1 ring-zinc">
          <summary className="cursor-pointer font-semibold">
            ¿Qué impresora me compro y cómo la conecto?
          </summary>
          <div className="mt-2 space-y-2 text-tinta-suave">
            <p>
              Vale cualquier impresora térmica de tickets compatible con <b>ESC/POS</b> (Epson
              TM-T20/TM-m30, Star TSP100/143 en modo ESC/POS, Bixolon, Xprinter, Rongta…). Para
              cocina, mejor con <b>cable de red o wifi</b>: así imprime aunque no haya ninguna
              pantalla encendida a su lado.
            </p>
            <p>
              <b>Por red:</b> enciéndela manteniendo pulsado el botón de avance de papel: sale una
              hoja con su IP. Ponla aquí con el puerto 9100. El ordenador donde corre este programa
              tiene que estar en la misma red.
            </p>
            <p>
              <b>Por USB o con su driver:</b> elige «desde el navegador» y en la pantalla que la
              tenga conectada activa abajo el puesto de impresión. Con USB directo (Chrome o Edge)
              no sale el diálogo de imprimir y abre el cajón.
            </p>
            <p>
              <b>Cajón portamonedas:</b> se conecta a la impresora de tickets con su cable RJ11 y se
              abre solo al cobrar en efectivo.
            </p>
          </div>
        </details>
      </section>

      {puente && <Puente clave={puente.clave} />}

      <EstaPantalla />

      <section aria-labelledby="t-cola">
        <h2 id="t-cola" className="mb-3 font-rotulo text-3xl font-bold">
          Lo último que se ha impreso
        </h2>
        {trabajos.length === 0 ? (
          <Vacio titulo="Nada todavía" />
        ) : (
          <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
            {trabajos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="w-12 text-sm text-tinta-suave">{formatearHora(t.creadoEn)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.titulo}</span>
                  <span
                    className={clsx(
                      "block text-sm",
                      t.estado === "error" ? "font-semibold text-aviso" : "text-tinta-suave",
                    )}
                  >
                    {ESTADO_TRABAJO[t.estado]}
                    {t.impresoraId &&
                      ` · ${estado.impresoras.find((i) => i.id === t.impresoraId)?.nombre ?? ""}`}
                    {t.error && ` · ${t.error}`}
                  </span>
                </span>
                <Boton tamano="pequeno" variante="fantasma" onClick={() => setViendo(t)}>
                  <Eye aria-hidden className="size-4" /> Ver
                </Boton>
                {t.estado === "error" ? (
                  <Boton
                    tamano="pequeno"
                    onClick={() => hacer({ tipo: "reintentar_trabajo", trabajoId: t.id })}
                  >
                    <RotateCw aria-hidden className="size-4" /> Reintentar
                  </Boton>
                ) : (
                  <Boton
                    tamano="pequeno"
                    onClick={() =>
                      imprimirUno(t.id, {
                        ...leerConfig(),
                        metodo:
                          leerConfig().metodo === "ninguno" ? "navegador" : leerConfig().metodo,
                      }).catch((e: Error) => avisar(e.message, "error"))
                    }
                  >
                    <Printer aria-hidden className="size-4" /> Aquí
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialogo
        abierto={viendo !== null}
        alCerrar={() => setViendo(null)}
        titulo={viendo?.titulo ?? ""}
      >
        {viendo && (
          <div className="overflow-x-auto bg-zinc p-3">
            <Papel
              documento={viendo.documento}
              columnas={estado.impresoras.find((i) => i.id === viendo.impresoraId)?.columnas ?? 48}
              className="mx-auto shadow"
            />
          </div>
        )}
      </Dialogo>

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? "Editar impresora" : "Añadir impresora"}
      >
        {borrador && (
          <div className="space-y-4">
            <Campo etiqueta="Nombre">
              <input
                className={claseEntrada}
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                placeholder="Cocina"
              />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Conexión</legend>
              <div className="flex flex-wrap gap-2">
                <Boton
                  variante={borrador.conexion === "red" ? "primario" : "secundario"}
                  onClick={() => setBorrador({ ...borrador, conexion: "red" })}
                >
                  Red o wifi (IP)
                </Boton>
                <Boton
                  variante={borrador.conexion === "navegador" ? "primario" : "secundario"}
                  onClick={() => setBorrador({ ...borrador, conexion: "navegador" })}
                >
                  Desde el navegador o USB
                </Boton>
              </div>
            </fieldset>
            {borrador.conexion === "red" && (
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Campo etiqueta="IP">
                  <input
                    className={claseEntrada}
                    value={borrador.ip}
                    onChange={(e) => setBorrador({ ...borrador, ip: e.target.value.trim() })}
                    placeholder="192.168.1.120"
                  />
                </Campo>
                <Campo etiqueta="Puerto">
                  <input
                    className={claseEntrada}
                    inputMode="numeric"
                    value={borrador.puerto}
                    onChange={(e) =>
                      setBorrador({
                        ...borrador,
                        puerto: Number(e.target.value.replace(/\D/g, "")) || 9100,
                      })
                    }
                  />
                </Campo>
              </div>
            )}
            <Campo etiqueta="Papel">
              <select
                className={claseEntrada}
                value={borrador.columnas}
                onChange={(e) => setBorrador({ ...borrador, columnas: Number(e.target.value) })}
              >
                <option value={48}>80 mm (48 caracteres)</option>
                <option value={42}>80 mm, letra grande (42 caracteres)</option>
                <option value={32}>58 mm (32 caracteres)</option>
              </select>
            </Campo>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Qué imprime</legend>
              <Interruptor
                activo={borrador.imprimeCocina}
                alCambiar={(v) => setBorrador({ ...borrador, imprimeCocina: v })}
                etiqueta="Comandas de cocina"
              />
              <Interruptor
                activo={borrador.imprimeBarra}
                alCambiar={(v) => setBorrador({ ...borrador, imprimeBarra: v })}
                etiqueta="Comandas de barra"
              />
              <Interruptor
                activo={borrador.imprimeTickets}
                alCambiar={(v) => setBorrador({ ...borrador, imprimeTickets: v })}
                etiqueta="Tickets, cuentas y cierres de caja"
              />
              <Interruptor
                activo={borrador.abreCajon}
                alCambiar={(v) => setBorrador({ ...borrador, abreCajon: v })}
                etiqueta="Abre el cajón al cobrar en efectivo"
              />
              <Interruptor
                activo={borrador.activa}
                alCambiar={(v) => setBorrador({ ...borrador, activa: v })}
                etiqueta="Encendida"
              />
            </fieldset>
            <div className="flex justify-between">
              {borrador.id ? (
                <Boton
                  variante="peligro"
                  onClick={async () => {
                    if (
                      confirm("¿Quitar esta impresora?") &&
                      (await hacer({ tipo: "borrar_impresora", impresoraId: borrador.id! }))
                    )
                      setBorrador(null);
                  }}
                >
                  Quitar
                </Boton>
              ) : (
                <span />
              )}
              <Boton
                variante="primario"
                disabled={!borrador.nombre.trim()}
                onClick={async () => {
                  if (
                    await hacer(
                      { tipo: "guardar_impresora", impresora: borrador },
                      "Impresora guardada",
                    )
                  )
                    setBorrador(null);
                }}
              >
                Guardar
              </Boton>
            </div>
          </div>
        )}
      </Dialogo>
    </main>
  );
}

/** Ajustes de impresión de este aparato (se guardan en el navegador, no en el servidor). */
function EstaPantalla() {
  const { avisar } = useDatos();
  const [guardada, cambiar] = useGuardado<ConfigImpresion>(CLAVE_CONFIG, CONFIG_POR_DEFECTO);
  const config = { ...CONFIG_POR_DEFECTO, ...guardada };
  const usb = useDelNavegador(hayWebUsb, false);

  return (
    <section aria-labelledby="t-pantalla" className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <h2 id="t-pantalla" className="mb-1 font-rotulo text-3xl font-bold">
        Esta pantalla
      </h2>
      <p className="mb-4 text-sm text-tinta-suave">
        Para impresoras sin red. Se guarda solo en este aparato: configúralo en el ordenador o
        tablet que tenga la impresora al lado.
      </p>
      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-semibold">Cómo imprime</legend>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante={config.metodo === "navegador" ? "primario" : "secundario"}
            onClick={() => cambiar({ ...config, metodo: "navegador" })}
          >
            Diálogo de imprimir
          </Boton>
          <Boton
            variante={config.metodo === "usb" ? "primario" : "secundario"}
            disabled={!usb}
            onClick={() => cambiar({ ...config, metodo: "usb" })}
          >
            <Usb aria-hidden className="size-4" /> USB directo
          </Boton>
          <Boton
            variante={config.metodo === "ninguno" ? "primario" : "secundario"}
            onClick={() => cambiar({ ...config, metodo: "ninguno" })}
          >
            No imprime
          </Boton>
        </div>
        {!usb && (
          <p className="mt-1 text-xs text-tinta-suave">
            USB directo necesita Chrome o Edge y abrir la app por https o en localhost.
          </p>
        )}
        {config.metodo === "usb" && (
          <Boton
            className="mt-2"
            tamano="pequeno"
            onClick={() =>
              conectarUsb()
                .then((n) => avisar(`Conectada: ${n}`))
                .catch((e: Error) => avisar(e.message, "error"))
            }
          >
            Elegir impresora USB
          </Boton>
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">
          Puesto de impresión: imprime aquí aunque lo pidan desde otro aparato
        </legend>
        <Interruptor
          activo={config.estacion.cocina}
          alCambiar={(v) => cambiar({ ...config, estacion: { ...config.estacion, cocina: v } })}
          etiqueta="Comandas de cocina"
        />
        <Interruptor
          activo={config.estacion.barra}
          alCambiar={(v) => cambiar({ ...config, estacion: { ...config.estacion, barra: v } })}
          etiqueta="Comandas de barra"
        />
        <Interruptor
          activo={config.estacion.tickets}
          alCambiar={(v) => cambiar({ ...config, estacion: { ...config.estacion, tickets: v } })}
          etiqueta="Tickets que se cobran desde los móviles"
          ayuda="Útil si los camareros cobran en la PDA y el ticket sale en la caja."
        />
      </fieldset>
      <p className="mt-3 text-xs text-tinta-suave">
        Deja esta pantalla abierta (por ejemplo, en Cocina) para que imprima lo que llegue.
      </p>
    </section>
  );
}

/** Instrucciones del puente de impresión (solo cuando la app está en la nube). */
function Puente({ clave }: { clave: string }) {
  const { avisar } = useDatos();
  const [ver, setVer] = useState(false);
  const direccion = useDelNavegador(() => window.location.origin, "");
  const orden = `node puente-impresion.mjs ${direccion} ${ver ? clave : "••••••••"}`;
  return (
    <section aria-labelledby="t-puente" className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <h2 id="t-puente" className="mb-1 font-rotulo text-3xl font-bold">
        Puente de impresión
      </h2>
      <p className="mb-3 text-sm text-tinta-suave">
        La app está en internet y las impresoras de red están en el bar. El puente es un programa
        pequeño que se deja abierto en un ordenador del bar (en la misma red que las impresoras) y
        les pasa lo que hay que imprimir.
      </p>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
        <li>
          Instala Node.js (nodejs.org) en ese ordenador y{" "}
          <a href="/puente-impresion.mjs" download className="font-semibold text-cobalto underline">
            descarga el puente
          </a>
          .
        </li>
        <li>Abre una terminal en la carpeta de la descarga y escribe:</li>
      </ol>
      <pre className="mb-2 overflow-x-auto rounded-lg bg-tinta p-3 text-sm text-white">{orden}</pre>
      <div className="flex flex-wrap gap-2">
        <Boton tamano="pequeno" onClick={() => setVer((v) => !v)}>
          {ver ? "Ocultar la clave" : "Ver la clave"}
        </Boton>
        <Boton
          tamano="pequeno"
          onClick={() =>
            navigator.clipboard
              .writeText(`node puente-impresion.mjs ${direccion} ${clave}`)
              .then(() => avisar("Orden copiada"))
              .catch(() => avisar("No se ha podido copiar", "error"))
          }
        >
          Copiar la orden
        </Boton>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        No compartas la clave: con ella se pueden leer los trabajos de impresión. Los trabajos que
        esperan al puente salen abajo como «Imprimiendo…».
      </p>
    </section>
  );
}
