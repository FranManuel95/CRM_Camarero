"use client";

import clsx from "clsx";
import {
  Copy,
  LayoutTemplate,
  Plus,
  QrCode,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import {
  DibujoDecoracion,
  estiloEnPlano,
  LISTA_DECORACIONES,
  TIPOS_DECORACION,
} from "@/components/decoracion-plano";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import { formatearFecha } from "@/lib/fechas";
import type { Decoracion, FormaMesa, Mesa, TipoDecoracion } from "@/lib/dominio/tipos";

/** Lo que se puede mover en el plano: una mesa o una decoración. */
type Pieza = { id: string; x: number; y: number; ancho: number; alto: number };

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Tiempo sin tocar nada antes de guardar (así un deslizador no manda cien cambios). */
const ESPERA_GUARDAR = 450;

/**
 * Cambio hecho en esta pantalla que aún no ha vuelto del servidor: se pinta ya, se guarda al
 * rato y se olvida cuando los datos del servidor coinciden con él.
 */
type CambioLocal = {
  datos: Partial<Mesa> & Partial<Decoracion>;
  version: number;
  guardado: boolean;
};

/** ¿Lo que dice el servidor ya coincide con el cambio hecho aquí? */
const coincide = (base: object | undefined, datos: object) =>
  !base || Object.entries(datos).every(([k, v]) => (base as Record<string, unknown>)[k] === v);

/**
 * Editor del plano: se arrastran las mesas y las decoraciones (mostrador, paredes, puertas…) y
 * se cambian sus datos en el panel de al lado.
 */
export function EditorMesas() {
  const { estado, hacer } = useDatos();
  const zonas = [...estado.zonas].sort((a, b) => a.orden - b.orden);
  const [zonaId, setZonaId] = useState(zonas[0]?.id ?? "");
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  const plano = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const fotograma = useRef<number | null>(null);
  const posicion = useRef<{ id: string; x: number; y: number } | null>(null);

  // Los cambios se ven al momento. Los sueltos (marcar, soltar una pieza) se guardan ya; los
  // seguidos (deslizador, flechas) cuando se deja de tocar, de una vez.
  const [locales, setLocales] = useState<Record<string, CambioLocal>>({});
  /** Lo cambiado aquí que el servidor aún no ha confirmado, por pieza. */
  const sinConfirmar = useRef(new Map<string, { datos: CambioLocal["datos"]; version: number }>());
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ultimo = useRef({ estado });
  const mandarAhora = useRef<(id: string) => Promise<void>>(async () => {});
  useEffect(() => {
    ultimo.current = { estado };
    mandarAhora.current = mandar;
  });
  useEffect(() => {
    // Al salir de la pantalla (o cerrar la pestaña) se manda lo que estaba esperando.
    const t = temporizadores.current;
    const vaciar = () => {
      for (const [id, h] of t) {
        clearTimeout(h);
        void mandarAhora.current(id);
      }
      t.clear();
    };
    window.addEventListener("pagehide", vaciar);
    return () => {
      window.removeEventListener("pagehide", vaciar);
      vaciar();
    };
  }, []);

  const baseDe = (id: string) =>
    ultimo.current.estado.mesas.find((m) => m.id === id) ??
    ultimo.current.estado.decoraciones?.find((d) => d.id === id);

  // Cuando llegan datos nuevos del servidor, se olvida lo ya guardado que coincide con ellos.
  const [vistos, setVistos] = useState({ m: estado.mesas, d: estado.decoraciones });
  if (vistos.m !== estado.mesas || vistos.d !== estado.decoraciones) {
    setVistos({ m: estado.mesas, d: estado.decoraciones });
    setLocales((prev) => {
      const quedan = Object.entries(prev).filter(([id, c]) => {
        const base =
          estado.mesas.find((m) => m.id === id) ?? estado.decoraciones?.find((d) => d.id === id);
        return !(c.guardado && coincide(base, c.datos));
      });
      return quedan.length === Object.keys(prev).length ? prev : Object.fromEntries(quedan);
    });
  }

  const conLocal = <T extends { id: string }>(x: T): T => ({ ...x, ...locales[x.id]?.datos });
  const zona = zonas.find((z) => z.id === zonaId);
  const mesas = estado.mesas.filter((m) => m.zonaId === zonaId).map(conLocal);
  const decoraciones = (estado.decoraciones ?? []).filter((d) => d.zonaId === zonaId).map(conLocal);
  const elegida = mesas.find((m) => m.id === elegidaId);
  const elegidaDeco = decoraciones.find((d) => d.id === elegidaId);

  async function mandar(id: string) {
    const cambio = sinConfirmar.current.get(id);
    const base = baseDe(id);
    if (!cambio || !base) return;
    const version = cambio.version;
    let ok: boolean;
    if ("token" in base) {
      const { token: _t, ...datos } = { ...base, ...cambio.datos } as Mesa;
      void _t;
      ok = await hacer({ tipo: "guardar_mesa", mesa: datos });
    } else {
      const { texto, ...resto } = { ...base, ...cambio.datos } as Decoracion;
      ok = await hacer({
        tipo: "guardar_decoracion",
        decoracion: { ...resto, ...(texto?.trim() ? { texto: texto.trim() } : {}) },
      });
    }
    // Si mientras tanto se ha vuelto a cambiar, eso se guardará en su propio turno.
    if (sinConfirmar.current.get(id)?.version !== version) return;
    sinConfirmar.current.delete(id);
    setLocales((prev) => {
      const actual = prev[id];
      if (!actual) return prev;
      const { [id]: _quitado, ...resto } = prev;
      void _quitado;
      // Si no se pudo guardar, vuelve a como estaba (el aviso de error ya ha salido).
      if (!ok || coincide(baseDe(id), actual.datos)) return resto;
      return { ...prev, [id]: { ...actual, guardado: true } };
    });
  }

  /** Cambia una mesa o decoración en pantalla ya y la guarda (si es seguido, al parar). */
  function cambiar(id: string, datos: CambioLocal["datos"], seguido = false) {
    const previo = sinConfirmar.current.get(id);
    const nuevo = { datos: { ...previo?.datos, ...datos }, version: (previo?.version ?? 0) + 1 };
    sinConfirmar.current.set(id, nuevo);
    setLocales((prev) => ({ ...prev, [id]: { ...nuevo, guardado: false } }));
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    if (!seguido) {
      void mandar(id);
      return;
    }
    temporizadores.current.set(
      id,
      setTimeout(() => {
        temporizadores.current.delete(id);
        void mandar(id);
      }, ESPERA_GUARDAR),
    );
  }

  const guardar = (m: Mesa, cambios: Partial<Mesa>, seguido = false) => {
    cambiar(m.id, cambios, seguido);
    return Promise.resolve(true);
  };
  const guardarDeco = (d: Decoracion, cambios: Partial<Decoracion>, seguido = false) => {
    cambiar(d.id, cambios, seguido);
    return Promise.resolve(true);
  };

  function empezar(e: React.PointerEvent, m: Pieza) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    inicio.current = { px: e.clientX, py: e.clientY, x: m.x, y: m.y };
    setElegidaId(m.id);
  }
  function mover(e: React.PointerEvent, m: Pieza) {
    const caja = plano.current?.getBoundingClientRect();
    if (!inicio.current || !caja) return;
    const x = limitar(
      inicio.current.x + ((e.clientX - inicio.current.px) / caja.width) * 100,
      0,
      100 - m.ancho,
    );
    const y = limitar(
      inicio.current.y + ((e.clientY - inicio.current.py) / caja.height) * 100,
      0,
      100 - m.alto * 1.6,
    );
    // Un repintado por fotograma, aunque el dedo mande más movimientos.
    if (fotograma.current !== null) cancelAnimationFrame(fotograma.current);
    const pos = { id: m.id, x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
    posicion.current = pos;
    fotograma.current = requestAnimationFrame(() => {
      fotograma.current = null;
      setArrastre(pos);
    });
  }
  function soltar<T extends Pieza>(m: T, alGuardar: (m: T, c: Partial<Pieza>) => Promise<boolean>) {
    inicio.current = null;
    if (fotograma.current !== null) cancelAnimationFrame(fotograma.current);
    fotograma.current = null;
    const fin = posicion.current;
    posicion.current = null;
    if (fin?.id === m.id && (fin.x !== m.x || fin.y !== m.y))
      void alGuardar(m, { x: fin.x, y: fin.y });
    setArrastre(null);
  }
  function teclas<T extends Pieza>(
    e: React.KeyboardEvent,
    m: T,
    alGuardar: (m: T, c: Partial<Pieza>, seguido?: boolean) => Promise<boolean>,
  ) {
    const paso = e.shiftKey ? 5 : 1;
    const d = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    void alGuardar(
      m,
      {
        x: limitar(m.x + d[0]!, 0, 100 - m.ancho),
        y: limitar(m.y + d[1]!, 0, 100 - m.alto * 1.6),
      },
      true,
    );
  }

  async function nuevaDecoracion(tipo: TipoDecoracion) {
    if (!zona) return;
    const t = TIPOS_DECORACION[tipo];
    await hacer(
      {
        tipo: "guardar_decoracion",
        decoracion: {
          zonaId: zona.id,
          tipo,
          x: Math.round(50 - t.ancho / 2),
          y: 40,
          ancho: t.ancho,
          alto: t.alto,
          ...(t.texto ? { texto: t.texto } : {}),
        },
      },
      `${t.nombre} añadido al plano. Arrástralo a su sitio.`,
    );
  }

  async function nuevaMesa() {
    if (!zona) return;
    let n = estado.mesas.length + 1;
    while (estado.mesas.some((m) => m.nombre === `Mesa ${n}`)) n++;
    await hacer(
      {
        tipo: "guardar_mesa",
        mesa: {
          nombre: `Mesa ${n}`,
          zonaId: zona.id,
          x: 40,
          y: 40,
          ancho: 14,
          alto: 14,
          forma: "cuadrada",
          plazas: 4,
        },
      },
      `Mesa ${n} añadida`,
    );
  }

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-rotulo text-4xl font-bold">Mesas y QR</h1>
        <Link
          href="/gestion/mesas/qr"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 font-semibold ring-1 ring-zinc-oscuro hover:bg-zinc"
        >
          <QrCode aria-hidden className="size-4" /> Imprimir los QR
        </Link>
        <Boton variante="primario" onClick={nuevaMesa}>
          <Plus aria-hidden className="size-4" /> Añadir mesa
        </Boton>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {zonas.map((z) => (
          <Boton
            key={z.id}
            variante={z.id === zonaId ? "primario" : "secundario"}
            onClick={() => setZonaId(z.id)}
          >
            {z.nombre}
          </Boton>
        ))}
        <Boton
          variante="fantasma"
          onClick={async () => {
            const nombre = prompt("Nombre de la zona nueva (por ejemplo, Reservado):")?.trim();
            if (nombre)
              await hacer(
                { tipo: "guardar_zona", zona: { nombre, orden: zonas.length } },
                `Zona ${nombre} creada`,
              );
          }}
        >
          <Plus aria-hidden className="size-4" /> Zona
        </Boton>
        {zona && (
          <>
            <Boton
              variante="fantasma"
              onClick={async () => {
                const nombre = prompt("Nuevo nombre de la zona:", zona.nombre)?.trim();
                if (nombre) await hacer({ tipo: "guardar_zona", zona: { ...zona, nombre } });
              }}
            >
              Renombrar
            </Boton>
            <Boton
              variante="fantasma"
              onClick={async () => {
                if (
                  confirm(`¿Borrar la zona ${zona.nombre}?`) &&
                  (await hacer({ tipo: "borrar_zona", zonaId: zona.id }, "Zona borrada"))
                )
                  setZonaId(zonas.find((z) => z.id !== zona.id)?.id ?? "");
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              <span className="sr-only">Borrar zona</span>
            </Boton>
          </>
        )}
      </div>
      {zona && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Añadir al plano"
        >
          <span className="mr-1 text-sm font-semibold text-tinta-suave">Añadir al plano:</span>
          {LISTA_DECORACIONES.map((tipo) => (
            <Boton key={tipo} tamano="pequeno" onClick={() => nuevaDecoracion(tipo)}>
              <span aria-hidden className="block h-3 w-5 overflow-hidden rounded-sm">
                <DibujoDecoracion
                  decoracion={{ tipo, ancho: 5, alto: 2 }}
                  className="[&>svg]:hidden"
                />
              </span>
              {TIPOS_DECORACION[tipo].nombre}
            </Boton>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div>
          <div
            ref={plano}
            className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl bg-zinc ring-1 ring-zinc-oscuro sm:aspect-[16/9]"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(19 33 46 / 0.12) 1px, transparent 1px)",
              backgroundSize: "5% 8.9%",
            }}
          >
            {decoraciones.map((d) => {
              const pos = arrastre?.id === d.id ? { ...d, ...arrastre } : d;
              return (
                <button
                  key={d.id}
                  type="button"
                  onPointerDown={(e) => empezar(e, d)}
                  onPointerMove={(e) => mover(e, d)}
                  onPointerUp={() => soltar(d, guardarDeco)}
                  onKeyDown={(e) => teclas(e, d, guardarDeco)}
                  onFocus={() => setElegidaId(d.id)}
                  aria-label={`${TIPOS_DECORACION[d.tipo].nombre}${d.texto ? `: ${d.texto}` : ""}. Muévelo con las flechas.`}
                  style={estiloEnPlano(pos)}
                  className={clsx(
                    "absolute cursor-grab select-none active:cursor-grabbing",
                    d.id === elegidaId && "outline-2 outline-offset-2 outline-cobalto",
                  )}
                >
                  <DibujoDecoracion decoracion={d} />
                </button>
              );
            })}
            {mesas.map((m) => {
              const pos = arrastre?.id === m.id ? arrastre : m;
              return (
                <button
                  key={m.id}
                  type="button"
                  onPointerDown={(e) => empezar(e, m)}
                  onPointerMove={(e) => mover(e, m)}
                  onPointerUp={() => soltar(m, guardar)}
                  onKeyDown={(e) => teclas(e, m, guardar)}
                  onFocus={() => setElegidaId(m.id)}
                  aria-label={`${m.nombre}. Muévela con las flechas.`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${m.ancho}%`,
                    height: `${m.alto * 1.6}%`,
                  }}
                  className={clsx(
                    "absolute grid cursor-grab place-items-center bg-white font-rotulo text-lg font-bold ring-2 select-none active:cursor-grabbing",
                    m.forma === "redonda" ? "rounded-full" : "rounded-xl",
                    m.id === elegidaId ? "ring-cobalto" : "ring-zinc-oscuro",
                  )}
                >
                  {m.nombre}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-tinta-suave">
            Arrastra las mesas, el mostrador, las puertas… para dibujar tu local. Con el teclado:
            flechas (con Mayúsculas, más rápido).
          </p>
          <PlanosGuardados />
        </div>

        <aside
          aria-label="Datos de lo elegido"
          className="rounded-2xl bg-white p-4 ring-1 ring-zinc"
        >
          {elegidaDeco ? (
            <FormularioDecoracion
              key={elegidaDeco.id}
              decoracion={elegidaDeco}
              alGuardar={guardarDeco}
              alBorrar={() => setElegidaId(null)}
            />
          ) : !elegida ? (
            <p className="text-sm text-tinta-suave">
              Toca una mesa para cambiar su nombre, forma o plazas, o algo del plano para cambiar su
              tamaño.
            </p>
          ) : (
            <FormularioMesa
              key={elegida.id}
              mesa={elegida}
              alGuardar={guardar}
              alBorrar={() => setElegidaId(null)}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

function FormularioMesa({
  mesa,
  alGuardar,
  alBorrar,
}: {
  mesa: Mesa;
  /** «seguido»: cambios continuos (deslizador, cifras) que se guardan al parar. */
  alGuardar: (m: Mesa, c: Partial<Mesa>, seguido?: boolean) => Promise<boolean>;
  alBorrar: () => void;
}) {
  const { estado, hacer } = useDatos();
  const [nombre, setNombre] = useState(mesa.nombre);
  const [sinTicket, setSinTicket] = useState(Boolean(mesa.sinTicket));
  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre">
        <input
          className={claseEntrada}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() =>
            nombre.trim() && nombre !== mesa.nombre && alGuardar(mesa, { nombre: nombre.trim() })
          }
        />
      </Campo>
      <Campo etiqueta="Zona">
        <select
          className={claseEntrada}
          value={mesa.zonaId}
          onChange={(e) => alGuardar(mesa, { zonaId: e.target.value })}
        >
          {estado.zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Forma</legend>
        <div className="flex gap-1">
          {(["cuadrada", "redonda", "alargada"] as FormaMesa[]).map((f) => (
            <Boton
              key={f}
              tamano="pequeno"
              variante={mesa.forma === f ? "primario" : "secundario"}
              onClick={() => alGuardar(mesa, { forma: f, ancho: f === "alargada" ? 24 : 14 })}
            >
              {f[0]!.toUpperCase() + f.slice(1)}
            </Boton>
          ))}
        </div>
      </fieldset>
      <Campo etiqueta="Plazas">
        <input
          type="number"
          min={1}
          max={40}
          className={claseEntrada}
          value={mesa.plazas}
          onChange={(e) =>
            Number(e.target.value) >= 1 && alGuardar(mesa, { plazas: Number(e.target.value) }, true)
          }
        />
      </Campo>
      <Campo etiqueta="Tamaño en el plano">
        <input
          type="range"
          min={8}
          max={30}
          value={mesa.alto}
          onChange={(e) => {
            const alto = Number(e.target.value);
            void alGuardar(
              mesa,
              { alto, ancho: mesa.forma === "alargada" ? Math.min(60, alto * 1.7) : alto },
              true,
            );
          }}
          className="w-full"
        />
      </Campo>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0"
          checked={sinTicket}
          onChange={async (e) => {
            const valor = e.target.checked;
            setSinTicket(valor);
            if (!(await alGuardar(mesa, { sinTicket: valor }))) setSinTicket(!valor);
          }}
        />
        <span>
          <span className="font-semibold">Sin ticket en papel</span>
          <span className="block text-tinta-suave">
            Al cobrar no se imprime. Queda guardado y se puede sacar si lo piden.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2 border-t border-zinc pt-3">
        <Boton
          tamano="pequeno"
          onClick={() => {
            if (
              confirm(
                "El QR impreso de esta mesa dejará de funcionar y habrá que imprimir el nuevo. ¿Seguir?",
              )
            )
              void hacer({ tipo: "regenerar_qr", mesaId: mesa.id }, "QR nuevo generado");
          }}
        >
          <RefreshCw aria-hidden className="size-4" /> QR nuevo
        </Boton>
        <Boton
          tamano="pequeno"
          variante="peligro"
          onClick={async () => {
            if (
              confirm(`¿Borrar ${mesa.nombre}?`) &&
              (await hacer({ tipo: "borrar_mesa", mesaId: mesa.id }, "Mesa borrada"))
            )
              alBorrar();
          }}
        >
          <Trash2 aria-hidden className="size-4" /> Borrar
        </Boton>
      </div>
      <p className="text-xs text-tinta-suave">
        Haz un QR nuevo si alguien se lleva una foto del QR y pide desde fuera.
      </p>
    </div>
  );
}

function FormularioDecoracion({
  decoracion,
  alGuardar,
  alBorrar,
}: {
  decoracion: Decoracion;
  alGuardar: (d: Decoracion, c: Partial<Decoracion>, seguido?: boolean) => Promise<boolean>;
  alBorrar: () => void;
}) {
  const { hacer } = useDatos();
  const [texto, setTexto] = useState(decoracion.texto ?? "");
  const nombre = TIPOS_DECORACION[decoracion.tipo].nombre;
  return (
    <div className="space-y-3">
      <h2 className="font-rotulo text-2xl font-bold">{nombre}</h2>
      <Campo etiqueta="Lo que pone (opcional)">
        <input
          className={claseEntrada}
          value={texto}
          maxLength={30}
          placeholder="Por ejemplo, Entrada"
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => texto !== (decoracion.texto ?? "") && alGuardar(decoracion, { texto })}
        />
      </Campo>
      <Campo etiqueta="Ancho">
        <input
          type="range"
          min={1}
          max={100}
          value={decoracion.ancho}
          onChange={(e) =>
            alGuardar(
              decoracion,
              {
                ancho: Number(e.target.value),
                x: Math.min(decoracion.x, 100 - Number(e.target.value)),
              },
              true,
            )
          }
          className="w-full"
        />
      </Campo>
      <Campo etiqueta="Alto">
        <input
          type="range"
          min={1}
          max={62}
          step={0.5}
          value={decoracion.alto}
          onChange={(e) =>
            alGuardar(
              decoracion,
              {
                alto: Number(e.target.value),
                y: Math.max(0, Math.min(decoracion.y, 100 - Number(e.target.value) * 1.6)),
              },
              true,
            )
          }
          className="w-full"
        />
      </Campo>
      <div className="flex flex-wrap gap-2 border-t border-zinc pt-3">
        <Boton
          tamano="pequeno"
          onClick={() => {
            // Girar: lo ancho pasa a alto (las paredes y ventanas, de horizontal a vertical).
            const alto = limitar(Math.round(decoracion.ancho / 1.6), 1, 62);
            const ancho = limitar(Math.round(decoracion.alto * 1.6), 1, 100);
            void alGuardar(decoracion, {
              ancho,
              alto,
              x: Math.min(decoracion.x, 100 - ancho),
              y: Math.max(0, Math.min(decoracion.y, 100 - alto * 1.6)),
            });
          }}
        >
          <RotateCw aria-hidden className="size-4" /> Girar
        </Boton>
        <Boton
          tamano="pequeno"
          onClick={() => {
            const { id: _id, texto: t, ...resto } = decoracion;
            void _id;
            void hacer(
              {
                tipo: "guardar_decoracion",
                decoracion: {
                  ...resto,
                  x: Math.min(resto.x + 3, 100 - resto.ancho),
                  y: Math.min(resto.y + 3, 100 - resto.alto * 1.6),
                  ...(t ? { texto: t } : {}),
                },
              },
              `${nombre} duplicado`,
            );
          }}
        >
          <Copy aria-hidden className="size-4" /> Duplicar
        </Boton>
        <Boton
          tamano="pequeno"
          variante="peligro"
          onClick={async () => {
            if (
              await hacer(
                { tipo: "borrar_decoracion", decoracionId: decoracion.id },
                `${nombre} quitado del plano`,
              )
            )
              alBorrar();
          }}
        >
          <Trash2 aria-hidden className="size-4" /> Quitar
        </Boton>
      </div>
    </div>
  );
}

/** Distribuciones guardadas («Invierno», «Verano con terraza», «Evento») para cambiar de golpe. */
function PlanosGuardados() {
  const { estado, hacer } = useDatos();
  const planos = estado.planos ?? [];
  return (
    <section aria-labelledby="t-planos" className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id="t-planos" className="mr-auto font-rotulo text-2xl font-bold">
          Distribuciones guardadas
        </h2>
        <Boton
          tamano="pequeno"
          onClick={async () => {
            const nombre = prompt(
              "Nombre para esta distribución (por ejemplo, Verano o Evento):",
            )?.trim();
            if (nombre)
              await hacer({ tipo: "guardar_plano", nombre }, `Distribución «${nombre}» guardada`);
          }}
        >
          <Save aria-hidden className="size-4" /> Guardar la de ahora
        </Boton>
      </div>
      <p className="mb-2 text-sm text-tinta-suave">
        Guarda cómo están colocadas las mesas y lo demás para volver a ello con un toque: por
        ejemplo, una para invierno y otra para el verano con la terraza.
      </p>
      {planos.length === 0 ? (
        <p className="text-sm text-tinta-suave">Ninguna todavía.</p>
      ) : (
        <ul className="divide-y divide-zinc">
          {planos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.nombre}</span>
                <span className="block text-sm text-tinta-suave">
                  Guardada el {formatearFecha(p.guardadoEn)}
                </span>
              </span>
              <Boton
                tamano="pequeno"
                variante="primario"
                aria-label={`Usar la distribución ${p.nombre}`}
                onClick={() => {
                  if (confirm(`¿Colocar las mesas como en «${p.nombre}»?`))
                    void hacer(
                      { tipo: "usar_plano", planoId: p.id },
                      `Plano cambiado a «${p.nombre}»`,
                    );
                }}
              >
                <LayoutTemplate aria-hidden className="size-4" /> Usar
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Guardar lo de ahora en ${p.nombre}`}
                onClick={() => {
                  if (confirm(`¿Guardar cómo está ahora el plano en «${p.nombre}»?`))
                    void hacer({ tipo: "guardar_plano", nombre: p.nombre }, "Guardada");
                }}
              >
                <Save aria-hidden className="size-4" />
              </Boton>
              <Boton
                tamano="pequeno"
                variante="fantasma"
                aria-label={`Borrar la distribución ${p.nombre}`}
                onClick={() => {
                  if (confirm(`¿Borrar la distribución «${p.nombre}»?`))
                    void hacer({ tipo: "borrar_plano", planoId: p.id }, "Borrada");
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
