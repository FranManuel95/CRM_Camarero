"use client";

import clsx from "clsx";
import { Bell, Check, Minus, Plus, Receipt, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { useEnDirecto } from "@/lib/cliente/use-en-directo";
import { useGuardado } from "@/lib/cliente/use-guardado";
import type { LineaPedida } from "@/lib/dominio/acciones";
import { euros } from "@/lib/dominio/importes";
import { type Alergeno, ALERGENOS, NOMBRE_ALERGENO } from "@/lib/dominio/tipos";
import type { ConfigDirecto } from "@/lib/servidor/almacen";
import type { VistaCliente } from "@/lib/servidor/vistas";

type Producto = VistaCliente["productos"][number];
type EnCesta = LineaPedida & { clave: string };

const ESTADO_CLIENTE = {
  por_confirmar: "Esperando al camarero",
  anotada: "Anotado",
  enviada: "Preparando",
  lista: "¡Listo! Ya viene",
  servida: "Servido",
  anulada: "Anulado",
} as const;

function precioDe(p: Producto, opciones: string[]) {
  return (
    p.precio +
    p.grupos
      .flatMap((g) => g.opciones)
      .filter((o) => opciones.includes(o.id))
      .reduce((s, o) => s + o.suplemento, 0)
  );
}

export function CartaCliente({
  local,
  token,
  inicial,
  directo,
}: {
  local: string;
  token: string;
  inicial: VistaCliente;
  directo: ConfigDirecto;
}) {
  const [vista, setVista] = useState(inicial);
  const [cesta, setCesta] = useGuardado<EnCesta[]>(`comanda.cesta.${token}`, [], "sesion");
  const [sinAlergenos, setSinAlergenos] = useState<Alergeno[]>([]);
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [verCesta, setVerCesta] = useState(false);
  const [verCuenta, setVerCuenta] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { refrescar } = useEnDirecto<VistaCliente>(
    directo,
    { eventos: `/api/mesa/${local}/${token}/eventos`, datos: `/api/mesa/${local}/${token}` },
    setVista,
    // El QR ha dejado de valer (lo han regenerado): al recargar sale el aviso.
    () => window.location.reload(),
  );

  const porId = useMemo(() => new Map(vista.productos.map((p) => [p.id, p])), [vista.productos]);
  const totalCesta = cesta.reduce((s, l) => {
    const p = porId.get(l.productoId);
    return p ? s + precioDe(p, l.opciones) * l.cantidad : s;
  }, 0);
  const unidadesCesta = cesta.reduce((s, l) => s + l.cantidad, 0);
  const pedir = vista.local.pedidosActivos;

  function avisar(texto: string, error = false) {
    setMensaje({ texto, error });
    setTimeout(() => setMensaje(null), error ? 6000 : 3500);
  }

  async function mandar(accion: object) {
    setEnviando(true);
    try {
      const r = await fetch(`/api/mesa/${local}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accion),
      });
      const datos = (await r.json()) as { error?: string };
      if (datos.error) {
        avisar(datos.error, true);
        return false;
      }
      if (directo.tipo === "supabase") refrescar();
      return true;
    } catch {
      avisar("No hay conexión. Prueba otra vez o llama al camarero.", true);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  function añadir(linea: LineaPedida) {
    setCesta((c) => {
      const clave = `${linea.productoId}|${[...linea.opciones].sort().join(",")}|${linea.nota}`;
      const previa = c.find((l) => l.clave === clave);
      if (previa)
        return c.map((l) =>
          l.clave === clave ? { ...l, cantidad: Math.min(99, l.cantidad + linea.cantidad) } : l,
        );
      return [...c, { ...linea, clave }];
    });
    avisar("Añadido a tu pedido");
  }

  async function enviarPedido() {
    const lineas = cesta.map(({ productoId, cantidad, opciones, nota }) => ({
      productoId,
      cantidad,
      opciones,
      nota,
    }));
    if (await mandar({ tipo: "pedir", lineas })) {
      setCesta([]);
      setVerCesta(false);
      avisar(
        vista.local.confirmarPedidos
          ? "¡Pedido enviado! El camarero lo confirma enseguida."
          : "¡Pedido enviado a cocina!",
      );
    }
  }

  const visibles = vista.productos.filter(
    (p) => !p.alergenos.some((a) => sinAlergenos.includes(a)),
  );
  const llamado = vista.avisos.includes("llamar");
  const cuentaPedida = vista.avisos.includes("cuenta");

  return (
    <div className="min-h-dvh bg-white pb-32">
      <header className="azulejo">
        <div className="bg-gradient-to-b from-transparent to-cobalto-oscuro/80 px-4 pt-10 pb-5 text-white">
          <p className="text-sm font-semibold opacity-90">{vista.mesa.nombre}</p>
          <h1 className="font-rotulo text-5xl leading-none font-bold drop-shadow">
            {vista.local.nombre}
          </h1>
          {!pedir && <p className="mt-2 text-sm">Consulta la carta y pide al camarero.</p>}
        </div>
      </header>

      <nav
        aria-label="Secciones de la carta"
        className="sticky top-0 z-30 border-b border-zinc bg-white/95 backdrop-blur"
      >
        <ul className="flex gap-1 overflow-x-auto px-3 py-2">
          {vista.categorias.map((c) => (
            <li key={c.id}>
              <a
                href={`#cat-${c.id}`}
                className="block h-9 shrink-0 rounded-full bg-zinc-claro px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-zinc"
              >
                {c.nombre}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <details className="mx-4 mt-4 rounded-xl bg-zinc-claro p-3 text-sm">
        <summary className="cursor-pointer font-semibold">
          Alergias e intolerancias{sinAlergenos.length ? ` · ocultando ${sinAlergenos.length}` : ""}
        </summary>
        <p className="mt-2 mb-2 text-tinta-suave">
          Marca lo que no puedes tomar y escondemos los platos que lo llevan.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALERGENOS.map((a) => {
            const activo = sinAlergenos.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  setSinAlergenos((s) => (activo ? s.filter((x) => x !== a) : [...s, a]))
                }
                className={clsx(
                  "h-9 rounded-full px-3 ring-1",
                  activo ? "bg-aviso text-white ring-aviso" : "bg-white ring-zinc-oscuro",
                )}
              >
                {activo ? "Sin " : ""}
                {NOMBRE_ALERGENO[a].toLowerCase()}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          Si tienes una alergia grave, díselo también al camarero.
        </p>
      </details>

      <main className="px-4">
        {vista.categorias.map((c) => {
          const productos = visibles.filter((p) => p.categoriaId === c.id);
          if (!productos.length) return null;
          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              className="scroll-mt-16 pt-6"
              aria-labelledby={`t-${c.id}`}
            >
              <h2
                id={`t-${c.id}`}
                className="mb-2 border-b-2 border-cobalto pb-1 font-rotulo text-3xl font-bold text-cobalto"
              >
                {c.nombre}
              </h2>
              <ul className="divide-y divide-zinc">
                {productos.map((p) => (
                  <li key={p.id} className={clsx("flex gap-3 py-3", !p.disponible && "opacity-50")}>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg leading-tight font-semibold">{p.nombre}</h3>
                      {p.descripcion && <p className="text-sm text-tinta-suave">{p.descripcion}</p>}
                      {p.alergenos.length > 0 && (
                        <p className="mt-1 text-xs text-tinta-suave">
                          Contiene:{" "}
                          {p.alergenos.map((a) => NOMBRE_ALERGENO[a].toLowerCase()).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-rotulo text-xl font-bold">{euros(p.precio)}</span>
                      {!p.disponible ? (
                        <span className="text-sm font-semibold">Agotado</span>
                      ) : pedir ? (
                        <button
                          type="button"
                          onClick={() =>
                            p.grupos.length
                              ? setDetalle(p)
                              : añadir({ productoId: p.id, cantidad: 1, opciones: [], nota: "" })
                          }
                          className="flex h-10 items-center gap-1 rounded-full bg-cobalto px-4 text-sm font-semibold text-white active:scale-95"
                          aria-label={`Añadir ${p.nombre}`}
                        >
                          <Plus aria-hidden className="size-4" /> Añadir
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="py-8 text-center text-xs text-tinta-suave">Precios con IVA incluido.</p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc bg-white/95 p-3 backdrop-blur">
        {mensaje && (
          <p
            role="status"
            className={clsx(
              "mx-auto mb-2 max-w-md rounded-lg px-3 py-2 text-center text-sm font-semibold text-white",
              mensaje.error ? "bg-aviso" : "bg-tinta",
            )}
          >
            {mensaje.texto}
          </p>
        )}
        <div className="mx-auto grid max-w-md grid-cols-[1fr_1fr] gap-2">
          <Boton
            disabled={llamado || enviando}
            onClick={async () => {
              if (await mandar({ tipo: "llamar_camarero" })) avisar("Avisado. Viene enseguida.");
            }}
          >
            {llamado ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Bell aria-hidden className="size-4" />
            )}
            {llamado ? "Ya viene" : "Llamar camarero"}
          </Boton>
          <Boton disabled={!vista.cuenta} onClick={() => setVerCuenta(true)}>
            <Receipt aria-hidden className="size-4" />{" "}
            {vista.cuenta ? `Mi cuenta · ${euros(vista.cuenta.total)}` : "Mi cuenta"}
          </Boton>
          {pedir && unidadesCesta > 0 && (
            <Boton
              variante="primario"
              tamano="grande"
              className="col-span-2"
              onClick={() => setVerCesta(true)}
            >
              <ShoppingBag aria-hidden className="size-5" /> Ver pedido ({unidadesCesta}) ·{" "}
              {euros(totalCesta)}
            </Boton>
          )}
        </div>
      </div>

      {detalle && (
        <Opciones
          producto={detalle}
          alCerrar={() => setDetalle(null)}
          alAñadir={(l) => {
            añadir(l);
            setDetalle(null);
          }}
        />
      )}

      <Dialogo abierto={verCesta} alCerrar={() => setVerCesta(false)} titulo="Tu pedido">
        <ul className="mb-4 divide-y divide-zinc">
          {cesta.map((l) => {
            const p = porId.get(l.productoId);
            if (!p) return null;
            const opciones = p.grupos
              .flatMap((g) => g.opciones)
              .filter((o) => l.opciones.includes(o.id));
            return (
              <li key={l.clave} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.nombre}</p>
                  {opciones.length > 0 && (
                    <p className="text-sm text-tinta-suave">
                      {opciones.map((o) => o.nombre).join(", ")}
                    </p>
                  )}
                  {l.nota && <p className="text-sm text-tinta-suave">«{l.nota}»</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-full p-2 ring-1 ring-zinc-oscuro"
                    aria-label={`Quitar una de ${p.nombre}`}
                    onClick={() =>
                      setCesta((c) =>
                        c.flatMap((x) =>
                          x.clave !== l.clave
                            ? [x]
                            : x.cantidad > 1
                              ? [{ ...x, cantidad: x.cantidad - 1 }]
                              : [],
                        ),
                      )
                    }
                  >
                    <Minus aria-hidden className="size-4" />
                  </button>
                  <span className="w-6 text-center font-semibold">{l.cantidad}</span>
                  <button
                    type="button"
                    className="rounded-full p-2 ring-1 ring-zinc-oscuro"
                    aria-label={`Una más de ${p.nombre}`}
                    onClick={() =>
                      setCesta((c) =>
                        c.map((x) =>
                          x.clave === l.clave
                            ? { ...x, cantidad: Math.min(99, x.cantidad + 1) }
                            : x,
                        ),
                      )
                    }
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </div>
                <span className="w-16 text-right font-semibold tabular-nums">
                  {euros(precioDe(p, l.opciones) * l.cantidad)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mb-4 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{euros(totalCesta)}</span>
        </p>
        <Boton
          variante="primario"
          tamano="grande"
          className="w-full"
          disabled={!cesta.length || enviando}
          onClick={enviarPedido}
        >
          Enviar pedido
        </Boton>
        <p className="mt-2 text-center text-xs text-tinta-suave">
          {vista.local.confirmarPedidos
            ? "El camarero lo confirma y lo pasa a cocina."
            : "Va directo a cocina y barra."}{" "}
          Se paga al final.
        </p>
      </Dialogo>

      <Dialogo abierto={verCuenta} alCerrar={() => setVerCuenta(false)} titulo="Tu cuenta">
        {vista.cuenta && (
          <>
            <ul className="mb-3 divide-y divide-zinc">
              {vista.cuenta.lineas.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold">
                      {l.cantidad} × {l.nombre}
                    </p>
                    <p
                      className={clsx(
                        "text-sm",
                        l.estado === "lista" ? "font-semibold text-cuenta" : "text-tinta-suave",
                      )}
                    >
                      {ESTADO_CLIENTE[l.estado]}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {l.invitacion
                      ? "Invita la casa"
                      : l.estado === "por_confirmar"
                        ? "—"
                        : euros(
                            (l.precioUnitario + l.opciones.reduce((s, o) => s + o.suplemento, 0)) *
                              l.cantidad,
                          )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mb-4 flex justify-between text-xl font-semibold">
              <span>Total</span>
              <span>{euros(vista.cuenta.total)}</span>
            </p>
            {cuentaPedida ? (
              <p className="rounded-lg bg-cuenta-claro p-3 text-center font-semibold">
                Ya hemos avisado: te traen la cuenta.
              </p>
            ) : (
              <>
                <p className="mb-2 font-semibold">Pedir la cuenta</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["tarjeta", "efectivo", "bizum"] as const).map((m) => (
                    <Boton
                      key={m}
                      disabled={enviando}
                      onClick={async () => {
                        if (await mandar({ tipo: "pedir_cuenta", metodo: m }))
                          avisar("Avisado. Te traen la cuenta.");
                      }}
                    >
                      {m === "tarjeta" ? "Con tarjeta" : m === "efectivo" ? "En efectivo" : "Bizum"}
                    </Boton>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Dialogo>
    </div>
  );
}

function Opciones({
  producto,
  alCerrar,
  alAñadir,
}: {
  producto: Producto;
  alCerrar: () => void;
  alAñadir: (l: LineaPedida) => void;
}) {
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const faltan = producto.grupos.filter(
    (g) => g.obligatorio && !g.opciones.some((o) => elegidas.includes(o.id)),
  );

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo={producto.nombre}>
      {producto.descripcion && <p className="mb-3 text-tinta-suave">{producto.descripcion}</p>}
      {producto.grupos.map((g) => (
        <fieldset key={g.id} className="mb-4">
          <legend className="mb-2 font-semibold">
            {g.nombre}{" "}
            <span className="text-sm font-normal text-tinta-suave">
              {g.obligatorio ? "· elige una" : "· opcional"}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {g.opciones.map((o) => {
              const activa = elegidas.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() =>
                    setElegidas((a) => {
                      if (g.multiple) return activa ? a.filter((i) => i !== o.id) : [...a, o.id];
                      const sin = a.filter((i) => !g.opciones.some((x) => x.id === i));
                      return activa ? sin : [...sin, o.id];
                    })
                  }
                  className={clsx(
                    "h-11 rounded-full px-4 ring-1",
                    activa ? "bg-cobalto text-white ring-cobalto" : "bg-white ring-zinc-oscuro",
                  )}
                >
                  {o.nombre}
                  {o.suplemento > 0 && ` +${euros(o.suplemento)}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Campo etiqueta="¿Algo que debamos saber?" className="mb-4">
        <input
          className={claseEntrada}
          value={nota}
          maxLength={140}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Sin cebolla, poco hecho…"
        />
      </Campo>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full p-2.5 ring-1 ring-zinc-oscuro"
            aria-label="Una menos"
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <span className="w-6 text-center text-lg font-semibold" aria-live="polite">
            {cantidad}
          </span>
          <button
            type="button"
            className="rounded-full p-2.5 ring-1 ring-zinc-oscuro"
            aria-label="Una más"
            onClick={() => setCantidad((c) => Math.min(99, c + 1))}
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        <Boton
          variante="primario"
          tamano="grande"
          disabled={faltan.length > 0}
          onClick={() =>
            alAñadir({ productoId: producto.id, cantidad, opciones: elegidas, nota: nota.trim() })
          }
        >
          Añadir · {euros(precioDe(producto, elegidas) * cantidad)}
        </Boton>
      </div>
    </Dialogo>
  );
}
