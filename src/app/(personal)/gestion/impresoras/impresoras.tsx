"use client";

import clsx from "clsx";
import {
  Bluetooth,
  CircleAlert,
  CircleCheck,
  Download,
  Eye,
  Monitor,
  Network,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Tablet,
  Usb,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Papel } from "@/components/papel";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor, Vacio } from "@/components/ui";
import { useAhora } from "@/lib/cliente/use-ahora";
import {
  BAUDIOS,
  describirConexion,
  puenteEnMarcha,
  VERSION_PUENTE,
} from "@/lib/dominio/impresoras";
import type {
  ConexionImpresora,
  EquipoPuente,
  Impresora,
  TrabajoImpresion,
} from "@/lib/dominio/tipos";
import { SE_IMPRIME_SOLA } from "@/lib/dominio/tipos";
import { formatearHora } from "@/lib/fechas";
import {
  type ConfigImpresion,
  type EnlaceImpresora,
  type ViaPantalla,
  capacidades,
  SIN_CAPACIDADES,
  CLAVE_CONFIG,
  CONFIG_POR_DEFECTO,
  conectarUsb,
  enlazar,
  imprimirUno,
  leerConfig,
} from "@/lib/cliente/impresion-local";
import { useDelNavegador, useGuardado } from "@/lib/cliente/use-guardado";

type Borrador = Omit<Impresora, "id"> & { id?: string };

const ESTADO_TRABAJO = {
  pendiente: "Imprimiendo…",
  impreso: "Impreso",
  error: "Error",
  en_navegador: "Esperando a su pantalla",
} as const;

const NOMBRE_VIA: Record<ViaPantalla, string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  serie: "puerto serie o Bluetooth emparejada",
  dialogo: "el diálogo de imprimir",
};

const NUEVA: Borrador = {
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
};

/** Configuración de impresión de esta pantalla (vive en el navegador de este aparato). */
function useConfigPantalla() {
  const [guardada, cambiar] = useGuardado<ConfigImpresion>(CLAVE_CONFIG, CONFIG_POR_DEFECTO);
  return [{ ...CONFIG_POR_DEFECTO, ...guardada }, cambiar] as const;
}

export function Impresoras({
  puente,
  enLaNube,
}: {
  puente: { clave: string } | null;
  enLaNube: boolean;
}) {
  const { estado, hacer, avisar } = useDatos();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [viendo, setViendo] = useState<TrabajoImpresion | null>(null);
  const [config] = useConfigPantalla();
  const trabajos = [...estado.trabajos].reverse().slice(0, 40);
  const necesitaPuente = estado.impresoras.some((i) => SE_IMPRIME_SOLA.has(i.conexion));

  return (
    <main className="space-y-8">
      <section aria-labelledby="t-imp">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 id="t-imp" className="font-rotulo text-4xl font-bold">
            Impresoras
          </h1>
          <Boton variante="primario" onClick={() => setBorrador({ ...NUEVA })}>
            <Plus aria-hidden className="size-4" /> Añadir impresora
          </Boton>
        </div>
        {estado.impresoras.length === 0 ? (
          <Vacio titulo="Aún no hay impresoras">
            Añade la primera: vale cualquier impresora de tickets, con cable de red, wifi, USB o
            Bluetooth.
          </Vacio>
        ) : (
          <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
            {estado.impresoras.map((i) => {
              const aqui = config.impresoras[i.id];
              return (
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
                      {describirConexion(i)}
                      {i.conexion === "navegador" &&
                        (aqui
                          ? ` · en esta pantalla, por ${NOMBRE_VIA[aqui.via]}`
                          : " · se conecta en su pantalla")}{" "}
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
                  <span className="ml-auto flex items-center gap-1">
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
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <details className="mt-3 rounded-xl bg-white p-4 text-sm ring-1 ring-zinc">
          <summary className="cursor-pointer font-semibold">
            ¿Qué impresora me compro y cómo la conecto?
          </summary>
          <div className="mt-2 space-y-2 text-tinta-suave">
            <p>
              Vale cualquier impresora térmica de tickets compatible con <b>ESC/POS</b> (Epson
              TM-T20/TM-m30, Star en modo ESC/POS, Bixolon, Xprinter, Rongta, Sunmi, las Bluetooth
              de 58 mm…), con cualquier conexión:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Cable de red o wifi</b>: lo más fiable para cocina, porque imprime aunque no haya
                ninguna pantalla encendida a su lado.
              </li>
              <li>
                <b>USB o Bluetooth en el ordenador del bar</b> (Windows, Mac o Linux): la instalas
                en el ordenador como siempre y el puente le manda lo que toca.
              </li>
              <li>
                <b>USB o Bluetooth en una tablet</b> (Android) <b>o en el ordenador de la caja</b>,
                desde Chrome: imprime esa pantalla mientras tenga la app abierta.
              </li>
            </ul>
            <p>
              <b>Cajón portamonedas:</b> se conecta a la impresora de tickets con su cable RJ11 y se
              abre solo al cobrar en efectivo.
            </p>
          </div>
        </details>
      </section>

      {enLaNube && puente ? (
        <Puente clave={puente.clave} destacado={necesitaPuente} />
      ) : (
        necesitaPuente && (
          <p className="flex items-start gap-2 rounded-2xl bg-cuenta-claro p-4 text-sm">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            Este ordenador imprime directamente en las impresoras de red, en las instaladas aquí y
            en sus puertos: no hace falta puente.
          </p>
        )
      )}

      <EstaPantalla />

      <section aria-labelledby="t-cola">
        <h2 id="t-cola" className="mb-3 font-rotulo text-3xl font-bold">
          Lo último que se ha impreso
        </h2>
        {trabajos.length === 0 ? (
          <Vacio titulo="Nada todavía" />
        ) : (
          <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
            {trabajos.map((t) => {
              const impresora = estado.impresoras.find((i) => i.id === t.impresoraId);
              return (
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
                      {impresora && ` · ${impresora.nombre}`}
                      {t.error && ` · ${t.error}`}
                    </span>
                  </span>
                  <Boton tamano="pequeno" variante="fantasma" onClick={() => setViendo(t)}>
                    <Eye aria-hidden className="size-4" /> Ver
                  </Boton>
                  {t.estado === "error" && (
                    <Boton
                      tamano="pequeno"
                      onClick={() =>
                        hacer(
                          { tipo: "reintentar_trabajo", trabajoId: t.id },
                          "Otra vez a imprimir",
                        )
                      }
                    >
                      <RotateCw aria-hidden className="size-4" /> Reintentar
                    </Boton>
                  )}
                  <Boton
                    tamano="pequeno"
                    variante="fantasma"
                    aria-label={`Imprimir aquí: ${t.titulo}`}
                    onClick={() =>
                      imprimirUno(
                        t.id,
                        {
                          impresoraId: config.impresoras[t.impresoraId ?? ""]
                            ? t.impresoraId
                            : null,
                        },
                        {
                          ...leerConfig(),
                          metodo: leerConfig().metodo === "usb" ? "usb" : "navegador",
                        },
                      ).catch((e: Error) => avisar(e.message, "error"))
                    }
                  >
                    <Printer aria-hidden className="size-4" /> Aquí
                  </Boton>
                </li>
              );
            })}
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
        ancho="max-w-2xl"
      >
        {borrador && (
          <FormularioImpresora
            key={borrador.id ?? "nueva"}
            inicial={borrador}
            enLaNube={enLaNube}
            alTerminar={() => setBorrador(null)}
          />
        )}
      </Dialogo>
    </main>
  );
}

/** Una opción grande con su explicación (radio de verdad, para el teclado y los lectores). */
function Opcion({
  nombre,
  valor,
  elegida,
  alElegir,
  icono: Icono,
  titulo,
  children,
}: {
  nombre: string;
  valor: string;
  elegida: boolean;
  alElegir: () => void;
  icono: typeof Printer;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-2 transition has-focus-visible:outline-3 has-focus-visible:outline-cobalto",
        elegida ? "bg-cobalto-claro ring-cobalto" : "bg-white ring-zinc hover:ring-zinc-oscuro",
      )}
    >
      <input
        type="radio"
        name={nombre}
        value={valor}
        checked={elegida}
        onChange={alElegir}
        className="sr-only"
      />
      <Icono aria-hidden className="mt-0.5 size-6 shrink-0" />
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-sm text-tinta-suave">{children}</span>
      </span>
    </label>
  );
}

type Grupo = "red" | "ordenador" | "pantalla";
const grupoDe = (c: ConexionImpresora): Grupo =>
  c === "red" ? "red" : c === "navegador" ? "pantalla" : "ordenador";

/** Lo que ve el ordenador que imprime: en la nube lo cuenta el puente; en el bar, el servidor. */
function useEquipo(enLaNube: boolean, activo: boolean) {
  const { estado } = useDatos();
  const [local, setLocal] = useState<EquipoPuente | null>(null);
  useEffect(() => {
    if (enLaNube || !activo) return;
    let vigente = true;
    fetch("/api/impresoras/equipo")
      .then((r) => r.json() as Promise<{ equipo: EquipoPuente | null }>)
      .then((d) => vigente && setLocal(d.equipo))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [enLaNube, activo]);
  return enLaNube ? (estado.puente ?? null) : local;
}

function FormularioImpresora({
  inicial,
  enLaNube,
  alTerminar,
}: {
  inicial: Borrador;
  enLaNube: boolean;
  alTerminar: () => void;
}) {
  const { hacer } = useDatos();
  const [b, setB] = useState<Borrador>(inicial);
  const grupo = grupoDe(b.conexion);
  const equipo = useEquipo(enLaNube, grupo === "ordenador");
  const cambiar = (c: Partial<Borrador>) => setB((x) => ({ ...x, ...c }));
  const listo =
    b.nombre.trim() &&
    (b.conexion !== "red" || b.ip) &&
    (b.conexion !== "sistema" || b.nombreSistema?.trim()) &&
    (b.conexion !== "puerto" || b.rutaPuerto?.trim());

  async function guardar() {
    const datos: Borrador = {
      ...b,
      nombreSistema: b.conexion === "sistema" ? b.nombreSistema?.trim() : undefined,
      rutaPuerto: b.conexion === "puerto" ? b.rutaPuerto?.trim() : undefined,
      baudios: b.conexion === "puerto" ? (b.baudios ?? 9600) : undefined,
    };
    if (await hacer({ tipo: "guardar_impresora", impresora: datos }, "Impresora guardada"))
      alTerminar();
  }

  return (
    <div className="space-y-5">
      <Campo etiqueta="Nombre">
        <input
          className={claseEntrada}
          value={b.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          placeholder="Cocina, Barra, Caja…"
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">¿Cómo está conectada?</legend>
        <Opcion
          nombre="conexion"
          valor="red"
          elegida={grupo === "red"}
          alElegir={() => cambiar({ conexion: "red" })}
          icono={Network}
          titulo="Con cable de red o por wifi"
        >
          Tiene su propia IP. Lo más fiable para cocina: imprime aunque no haya ninguna pantalla
          encendida.
        </Opcion>
        <Opcion
          nombre="conexion"
          valor="ordenador"
          elegida={grupo === "ordenador"}
          alElegir={() => cambiar({ conexion: "sistema" })}
          icono={Monitor}
          titulo="Por USB o Bluetooth a un ordenador del bar"
        >
          Windows, Mac o Linux.{" "}
          {enLaNube
            ? "Le manda lo que toca el puente de impresión que corre en ese ordenador."
            : "Le manda lo que toca este mismo programa."}
        </Opcion>
        <Opcion
          nombre="conexion"
          valor="pantalla"
          elegida={grupo === "pantalla"}
          alElegir={() => cambiar({ conexion: "navegador" })}
          icono={Tablet}
          titulo="Por USB o Bluetooth a una tablet, o a la pantalla de la caja"
        >
          La imprime esa pantalla mientras tenga la app abierta en Chrome (o con el diálogo de
          imprimir, si tiene su programa instalado).
        </Opcion>
      </fieldset>

      {grupo === "red" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo etiqueta="IP de la impresora">
              <input
                className={claseEntrada}
                inputMode="decimal"
                value={b.ip}
                onChange={(e) => cambiar({ ip: e.target.value.trim() })}
                placeholder="192.168.1.120"
              />
            </Campo>
            <Campo etiqueta="Puerto">
              <input
                className={claseEntrada}
                inputMode="numeric"
                value={b.puerto}
                onChange={(e) =>
                  cambiar({ puerto: Number(e.target.value.replace(/\D/g, "")) || 9100 })
                }
              />
            </Campo>
          </div>
          <p className="text-xs text-tinta-suave">
            ¿No sabes la IP? Apaga la impresora y enciéndela con el botón de avance de papel
            pulsado: sale una hoja con ella. El puerto casi siempre es 9100.
          </p>
        </div>
      )}

      {grupo === "ordenador" && (
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">
              En el ordenador, la impresora está…
            </legend>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante={b.conexion === "sistema" ? "primario" : "secundario"}
                aria-pressed={b.conexion === "sistema"}
                onClick={() => cambiar({ conexion: "sistema" })}
              >
                Instalada con su programa
              </Boton>
              <Boton
                variante={b.conexion === "puerto" ? "primario" : "secundario"}
                aria-pressed={b.conexion === "puerto"}
                onClick={() => cambiar({ conexion: "puerto", baudios: b.baudios ?? 9600 })}
              >
                En un puerto (COM, Bluetooth emparejada)
              </Boton>
            </div>
          </fieldset>
          {b.conexion === "sistema" ? (
            <Campo
              etiqueta="Nombre de la impresora en el ordenador"
              ayuda={
                equipo?.sistema.length
                  ? "Elígela de la lista o escríbela tal cual sale en el ordenador."
                  : "Tal cual sale en Impresoras del ordenador (por ejemplo, «EPSON TM-T20II Receipt»)."
              }
            >
              <input
                className={claseEntrada}
                list="impresoras-del-equipo"
                value={b.nombreSistema ?? ""}
                onChange={(e) => cambiar({ nombreSistema: e.target.value })}
                placeholder="EPSON TM-T20II Receipt"
              />
              <datalist id="impresoras-del-equipo">
                {equipo?.sistema.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Campo>
          ) : (
            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <Campo
                etiqueta="Puerto"
                ayuda={
                  equipo?.puertos.length
                    ? "Elígelo de la lista."
                    : "COM3 en Windows; /dev/rfcomm0 o /dev/usb/lp0 en Linux; /dev/cu.… en Mac."
                }
              >
                <input
                  className={claseEntrada}
                  list="puertos-del-equipo"
                  value={b.rutaPuerto ?? ""}
                  onChange={(e) => cambiar({ rutaPuerto: e.target.value.trim() })}
                  placeholder="COM3"
                />
                <datalist id="puertos-del-equipo">
                  {equipo?.puertos.map((p) => (
                    <option key={p.ruta} value={p.ruta}>
                      {p.nombre}
                    </option>
                  ))}
                </datalist>
              </Campo>
              <Campo etiqueta="Velocidad" ayuda="Si no lo sabes, 9600.">
                <select
                  className={claseEntrada}
                  value={b.baudios ?? 9600}
                  onChange={(e) => cambiar({ baudios: Number(e.target.value) })}
                >
                  {BAUDIOS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          )}
          {enLaNube && !equipo && (
            <p className="flex items-start gap-2 rounded-lg bg-ocupada-claro p-3 text-sm">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              El puente de impresión aún no se ha conectado: cuando lo instales en ese ordenador
              (más abajo, en esta página), aquí saldrán sus impresoras y puertos para elegir.
            </p>
          )}
        </div>
      )}

      {grupo === "pantalla" && (
        <p className="rounded-lg bg-zinc-claro p-3 text-sm">
          Después de guardar, en la pantalla que la tiene al lado: Gestión → Impresoras → «Esta
          pantalla» → elige cómo está conectada (USB, Bluetooth…) y pulsa «Conectar». Si es esta, lo
          puedes hacer ahora mismo, aquí abajo.
        </p>
      )}

      <Campo etiqueta="Papel">
        <select
          className={claseEntrada}
          value={b.columnas}
          onChange={(e) => cambiar({ columnas: Number(e.target.value) })}
        >
          <option value={48}>80 mm (48 caracteres)</option>
          <option value={42}>80 mm, letra grande (42 caracteres)</option>
          <option value={32}>58 mm (32 caracteres)</option>
        </select>
      </Campo>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Qué imprime</legend>
        <Interruptor
          activo={b.imprimeCocina}
          alCambiar={(v) => cambiar({ imprimeCocina: v })}
          etiqueta="Comandas de cocina"
        />
        <Interruptor
          activo={b.imprimeBarra}
          alCambiar={(v) => cambiar({ imprimeBarra: v })}
          etiqueta="Comandas de barra"
        />
        <Interruptor
          activo={b.imprimeTickets}
          alCambiar={(v) => cambiar({ imprimeTickets: v })}
          etiqueta="Tickets, cuentas y cierres de caja"
        />
        <Interruptor
          activo={b.abreCajon}
          alCambiar={(v) => cambiar({ abreCajon: v })}
          etiqueta="Abre el cajón al cobrar en efectivo"
        />
        <Interruptor
          activo={b.activa}
          alCambiar={(v) => cambiar({ activa: v })}
          etiqueta="Encendida"
        />
      </fieldset>
      <div className="flex justify-between">
        {b.id ? (
          <Boton
            variante="peligro"
            onClick={async () => {
              if (
                confirm("¿Quitar esta impresora?") &&
                (await hacer({ tipo: "borrar_impresora", impresoraId: b.id! }))
              )
                alTerminar();
            }}
          >
            Quitar
          </Boton>
        ) : (
          <span />
        )}
        <Boton variante="primario" disabled={!listo} onClick={guardar}>
          Guardar
        </Boton>
      </div>
    </div>
  );
}

/** Cómo imprime este aparato: las impresoras conectadas a él (se guarda en este navegador). */
function EstaPantalla() {
  const { estado, avisar } = useDatos();
  const [config, cambiar] = useConfigPantalla();
  const puede = useDelNavegador(capacidades, SIN_CAPACIDADES);
  const dePantalla = estado.impresoras.filter((i) => i.conexion === "navegador");

  return (
    <section aria-labelledby="t-pantalla" className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <h2 id="t-pantalla" className="mb-1 font-rotulo text-3xl font-bold">
        Esta pantalla
      </h2>
      <p className="mb-4 text-sm text-tinta-suave">
        Se guarda solo en este aparato: hazlo en la tablet u ordenador que tenga la impresora al
        lado, y déjalo con la app abierta para que imprima lo que llegue.
      </p>
      {dePantalla.length > 0 ? (
        <ul className="space-y-3">
          {dePantalla.map((i) => (
            <EnlaceEnPantalla
              key={i.id}
              impresora={i}
              enlace={config.impresoras[i.id]}
              puede={puede}
              alCambiar={(enlace) => {
                const impresoras = { ...config.impresoras };
                if (enlace) impresoras[i.id] = enlace;
                else delete impresoras[i.id];
                cambiar({ ...config, impresoras });
              }}
              alFallar={(m) => avisar(m, "error")}
              alConectar={(m) => avisar(m)}
            />
          ))}
        </ul>
      ) : estado.impresoras.length > 0 ? (
        <p className="text-sm text-tinta-suave">
          Ninguna impresora está puesta como «conectada a una pantalla». Si alguna lo está, edítala
          arriba y elige «Por USB o Bluetooth a una tablet, o a la pantalla de la caja».
        </p>
      ) : (
        <PantallaSinImpresoras config={config} cambiar={cambiar} usb={puede.usb} />
      )}
      {!puede.usb && !puede.bluetooth && !puede.serie && (
        <p className="mt-3 text-xs text-tinta-suave">
          Este navegador solo puede imprimir con el diálogo de imprimir. Para USB y Bluetooth
          directos, abre la app en Chrome o Edge.
        </p>
      )}
    </section>
  );
}

function EnlaceEnPantalla({
  impresora,
  enlace,
  puede,
  alCambiar,
  alFallar,
  alConectar,
}: {
  impresora: Impresora;
  enlace: EnlaceImpresora | undefined;
  puede: ReturnType<typeof capacidades>;
  alCambiar: (e: EnlaceImpresora | null) => void;
  alFallar: (mensaje: string) => void;
  alConectar: (mensaje: string) => void;
}) {
  const [via, setVia] = useState<ViaPantalla | "no">(enlace?.via ?? "no");
  const [baudios, setBaudios] = useState(enlace?.serie?.baudios ?? 9600);
  const [ocupado, setOcupado] = useState(false);
  const opciones: { via: ViaPantalla | "no"; texto: string; icono?: typeof Usb; vale: boolean }[] =
    [
      { via: "no", texto: "No está aquí", vale: true },
      { via: "usb", texto: "USB", icono: Usb, vale: puede.usb },
      { via: "bluetooth", texto: "Bluetooth", icono: Bluetooth, vale: puede.bluetooth },
      { via: "serie", texto: "Puerto serie / Bluetooth emparejada", vale: puede.serie },
      { via: "dialogo", texto: "Diálogo de imprimir", icono: Printer, vale: true },
    ];

  async function conectar() {
    if (via === "no" || via === "dialogo") {
      alCambiar(via === "no" ? null : { via: "dialogo", aparato: "Diálogo de imprimir" });
      return;
    }
    setOcupado(true);
    try {
      const nuevo = await enlazar(impresora.id, via, baudios);
      alCambiar(nuevo);
      alConectar(`${impresora.nombre}: conectada (${nuevo.aparato}). Prueba a imprimir.`);
    } catch (e) {
      // Cerrar el selector sin elegir no es un error que haya que enseñar.
      if (e instanceof Error && e.name !== "NotFoundError") alFallar(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-xl p-3 ring-1 ring-zinc">
      <p className="mb-2 font-semibold">
        {impresora.nombre}{" "}
        <span className="text-sm font-normal text-tinta-suave">
          {enlace ? `· conectada aquí por ${NOMBRE_VIA[enlace.via]}` : "· no conectada aquí"}
          {enlace?.aparato && enlace.via !== "dialogo" && ` (${enlace.aparato})`}
        </span>
      </p>
      <fieldset>
        <legend className="sr-only">Cómo está conectada {impresora.nombre} a esta pantalla</legend>
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => (
            <Boton
              key={o.via}
              tamano="pequeno"
              aria-pressed={via === o.via}
              variante={via === o.via ? "primario" : "secundario"}
              disabled={!o.vale}
              onClick={() => setVia(o.via)}
            >
              {o.icono && <o.icono aria-hidden className="size-4" />} {o.texto}
            </Boton>
          ))}
        </div>
      </fieldset>
      {via === "usb" && puede.windows && (
        <p className="mt-2 text-xs text-tinta-suave">
          En Windows, el USB directo suele chocar con el driver de la impresora. Si falla, edita la
          impresora y elige «Por USB o Bluetooth a un ordenador del bar» (con el puente).
        </p>
      )}
      {via === "bluetooth" && (
        <p className="mt-2 text-xs text-tinta-suave">
          Para las Bluetooth de bajo consumo. Si no aparece al buscar, emparéjala en los ajustes del
          aparato y usa «Puerto serie / Bluetooth emparejada».
        </p>
      )}
      {via === "serie" && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          Velocidad
          <select
            className={clsx(claseEntrada, "w-32")}
            value={baudios}
            onChange={(e) => setBaudios(Number(e.target.value))}
          >
            {BAUDIOS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span className="text-xs text-tinta-suave">(las Bluetooth la ignoran)</span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Boton
          tamano="pequeno"
          variante="primario"
          disabled={ocupado || (via === "no" && !enlace)}
          onClick={conectar}
        >
          {via === "no" ? "Guardar" : via === "dialogo" ? "Usar el diálogo" : "Conectar"}
        </Boton>
      </div>
    </li>
  );
}

/** Para bares sin impresoras dadas de alta: el puesto de impresión de antes. */
function PantallaSinImpresoras({
  config,
  cambiar,
  usb,
}: {
  config: ConfigImpresion;
  cambiar: (c: ConfigImpresion) => void;
  usb: boolean;
}) {
  const { avisar } = useDatos();
  return (
    <>
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
    </>
  );
}

/** El puente de impresión (solo con la app en la nube): cómo va y cómo se instala. */
function Puente({ clave, destacado }: { clave: string; destacado: boolean }) {
  const { estado, avisar } = useDatos();
  const ahora = useAhora(30_000);
  const [ver, setVer] = useState(false);
  const direccion = useDelNavegador(() => window.location.origin, "");
  const puente = estado.puente;
  const enMarcha = puenteEnMarcha(puente, ahora);
  const viejo = puente && puente.version !== VERSION_PUENTE;
  const orden = (c: string) => `node puente-impresion.mjs instalar ${direccion} ${c}`;
  const minutos = puente
    ? Math.max(0, Math.round((Date.parse(ahora) - Date.parse(puente.visto)) / 60_000))
    : 0;
  const SO = { windows: "Windows", mac: "Mac", linux: "Linux", otro: "otro sistema" } as const;

  return (
    <section
      aria-labelledby="t-puente"
      className={clsx(
        "rounded-2xl p-4 ring-1",
        destacado && !enMarcha ? "bg-aviso-claro ring-aviso" : "bg-white ring-zinc",
      )}
    >
      <h2 id="t-puente" className="mb-1 font-rotulo text-3xl font-bold">
        Puente de impresión
      </h2>
      <p className="mb-3 flex items-start gap-2 font-semibold" role="status">
        {enMarcha ? (
          <>
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-cuenta" />
            En marcha en un ordenador {SO[puente!.so]}
            {minutos > 1 ? ` (dio señales hace ${minutos} min)` : ""}.
          </>
        ) : puente ? (
          <>
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-aviso" />
            Sin señales desde las {formatearHora(puente.visto)}: lo de las impresoras del ordenador
            y de red no está saliendo. Revisa que ese ordenador esté encendido y con internet.
          </>
        ) : (
          <>
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            Aún no se ha conectado nunca.
          </>
        )}
      </p>
      {viejo && (
        <p className="mb-3 text-sm">
          Hay una versión nueva del puente: descárgalo otra vez e instálalo con la misma orden.
        </p>
      )}
      <details open={!enMarcha || Boolean(viejo)}>
        <summary className="cursor-pointer text-sm font-semibold">Cómo se instala</summary>
        <p className="mt-2 mb-3 text-sm text-tinta-suave">
          La app está en internet y las impresoras, en el bar. El puente es un programa pequeño que
          se deja en un ordenador del bar (Windows, Mac o Linux) y les manda lo que hay que
          imprimir: a las de red, a las instaladas en ese ordenador y a sus puertos. Se instala una
          vez y arranca solo cada vez que se enciende el ordenador.
        </p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
          <li>
            Instala Node.js en ese ordenador:{" "}
            <a
              href="https://nodejs.org/es/download"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-cobalto underline"
            >
              nodejs.org
            </a>{" "}
            (la versión «LTS», siguiente, siguiente).
          </li>
          <li>
            <a
              href="/puente-impresion.mjs"
              download
              className="inline-flex items-center gap-1 font-semibold text-cobalto underline"
            >
              <Download aria-hidden className="size-4" /> Descarga el puente
            </a>
            .
          </li>
          <li>
            Abre una terminal en la carpeta de Descargas (en Windows: botón derecho sobre la carpeta
            → «Abrir en Terminal») y pega esta orden:
          </li>
        </ol>
        <pre className="mb-2 overflow-x-auto rounded-lg bg-tinta p-3 text-sm text-white">
          {orden(ver ? clave : "••••••••")}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Boton tamano="pequeno" onClick={() => setVer((v) => !v)}>
            {ver ? "Ocultar la clave" : "Ver la clave"}
          </Boton>
          <Boton
            tamano="pequeno"
            onClick={() =>
              navigator.clipboard
                .writeText(orden(clave))
                .then(() => avisar("Orden copiada"))
                .catch(() => avisar("No se ha podido copiar", "error"))
            }
          >
            Copiar la orden
          </Boton>
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          No compartas la clave: con ella se pueden leer los trabajos de impresión. Para ver qué
          impresoras y puertos ve ese ordenador: <code>node puente-impresion.mjs listar</code>.
        </p>
      </details>
    </section>
  );
}
