"use client";

import clsx from "clsx";
import { Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada } from "@/components/ui";
import type { FormaMesa, Mesa } from "@/lib/dominio/tipos";

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Editor del plano: se arrastran las mesas y se cambian sus datos en el panel de al lado. */
export function EditorMesas() {
  const { estado, hacer } = useDatos();
  const zonas = [...estado.zonas].sort((a, b) => a.orden - b.orden);
  const [zonaId, setZonaId] = useState(zonas[0]?.id ?? "");
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  const plano = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const zona = zonas.find((z) => z.id === zonaId);
  const mesas = estado.mesas.filter((m) => m.zonaId === zonaId);
  const elegida = estado.mesas.find((m) => m.id === elegidaId);

  const guardar = (m: Mesa, cambios: Partial<Mesa>) => {
    const { token: _t, ...datos } = { ...m, ...cambios };
    void _t;
    return hacer({ tipo: "guardar_mesa", mesa: datos });
  };

  function empezar(e: React.PointerEvent, m: Mesa) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    inicio.current = { px: e.clientX, py: e.clientY, x: m.x, y: m.y };
    setElegidaId(m.id);
  }
  function mover(e: React.PointerEvent, m: Mesa) {
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
    setArrastre({ id: m.id, x: Math.round(x), y: Math.round(y) });
  }
  async function soltar(m: Mesa) {
    inicio.current = null;
    if (arrastre?.id === m.id && (arrastre.x !== m.x || arrastre.y !== m.y))
      await guardar(m, { x: arrastre.x, y: arrastre.y });
    setArrastre(null);
  }
  function teclas(e: React.KeyboardEvent, m: Mesa) {
    const paso = e.shiftKey ? 5 : 1;
    const d = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    void guardar(m, { x: limitar(m.x + d[0]!, 0, 100 - m.ancho), y: limitar(m.y + d[1]!, 0, 100) });
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
            {mesas.map((m) => {
              const pos = arrastre?.id === m.id ? arrastre : m;
              return (
                <button
                  key={m.id}
                  type="button"
                  onPointerDown={(e) => empezar(e, m)}
                  onPointerMove={(e) => mover(e, m)}
                  onPointerUp={() => soltar(m)}
                  onKeyDown={(e) => teclas(e, m)}
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
            Arrastra las mesas para colocarlas como en tu local. Con el teclado: flechas (con
            Mayúsculas, más rápido).
          </p>
        </div>

        <aside aria-label="Datos de la mesa" className="rounded-2xl bg-white p-4 ring-1 ring-zinc">
          {!elegida ? (
            <p className="text-sm text-tinta-suave">
              Toca una mesa para cambiar su nombre, forma o plazas.
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
  alGuardar: (m: Mesa, c: Partial<Mesa>) => Promise<boolean>;
  alBorrar: () => void;
}) {
  const { estado, hacer } = useDatos();
  const [nombre, setNombre] = useState(mesa.nombre);
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
            Number(e.target.value) >= 1 && alGuardar(mesa, { plazas: Number(e.target.value) })
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
            void alGuardar(mesa, {
              alto,
              ancho: mesa.forma === "alargada" ? Math.min(60, alto * 1.7) : alto,
            });
          }}
          className="w-full"
        />
      </Campo>
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
