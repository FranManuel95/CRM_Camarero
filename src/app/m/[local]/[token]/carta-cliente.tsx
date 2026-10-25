"use client";

import clsx from "clsx";
import {
  Bell,
  Check,
  Clock,
  CreditCard,
  Languages,
  Mail,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { useEnDirecto } from "@/lib/cliente/use-en-directo";
import { useGuardado } from "@/lib/cliente/use-guardado";
import { ALERGENO_EN, type Idioma, TEXTOS } from "@/lib/cliente/textos-carta";
import type { LineaPedida } from "@/lib/dominio/acciones";
import { euros } from "@/lib/dominio/importes";
import { type Alergeno, ALERGENOS, NOMBRE_ALERGENO } from "@/lib/dominio/tipos";
import type { ConfigDirecto } from "@/lib/servidor/almacen";
import type { VistaCliente } from "@/lib/servidor/vistas";

type Producto = VistaCliente["productos"][number];
type EnCesta = LineaPedida & { clave: string };

function precioDe(p: Producto, opciones: string[]) {
  return (
    p.precio +
    p.grupos
      .flatMap((g) => g.opciones)
      .filter((o) => opciones.includes(o.id))
      .reduce((s, o) => s + o.suplemento, 0)
  );
}

/** El texto en inglés si lo hay y se ha elegido inglés; si no, el original. */
const en = (idioma: Idioma, es: string, ingles?: string) =>
  idioma === "en" && ingles ? ingles : es;

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
  const [idiomaGuardado, setIdioma] = useGuardado<Idioma>("comanda.idioma", "es");
  // Si el bar apaga la carta en inglés, siempre en español.
  const idioma: Idioma = vista.local.ingles ? idiomaGuardado : "es";
  const t = TEXTOS[idioma];
  const nombreAlergeno = (a: Alergeno) =>
    (idioma === "en" ? ALERGENO_EN[a] : NOMBRE_ALERGENO[a]).toLowerCase();
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
  const llevar = vista.llevar;
  // Un encargo ya pagado no admite más pedidos (se hace otro).
  const pedir = vista.local.pedidosActivos && !(llevar && vista.ticket);
  const [verGracias, setVerGracias] = useState(true);
  const [pagando, setPagando] = useState(false);
  const encargoListo = Boolean(
    llevar &&
    vista.cuenta?.lineas.some((l) => l.estado === "lista") &&
    vista.cuenta.lineas.every((l) => ["lista", "servida", "anulada"].includes(l.estado)),
  );

  // Al volver de la página de pago: si se echó atrás, se le dice; la dirección queda limpia.
  useEffect(() => {
    const pago = new URLSearchParams(window.location.search).get("pago");
    if (!pago) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (pago === "cancelado") avisar(t.pagoCancelado);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cargar la página
  }, []);

  async function pagarConTarjeta() {
    setPagando(true);
    try {
      const r = await fetch(`/api/mesa/${local}/${token}/pago`, { method: "POST" });
      const datos = (await r.json()) as { url?: string; error?: string };
      if (datos.url) window.location.assign(datos.url);
      else {
        avisar(datos.error ?? t.sinConexion, true);
        setPagando(false);
      }
    } catch {
      avisar(t.sinConexion, true);
      setPagando(false);
    }
  }

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
      avisar(t.sinConexion, true);
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
    avisar(t.añadido);
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
      avisar(t.enviado(vista.local.confirmarPedidos));
    }
  }

  const visibles = vista.productos.filter(
    (p) => !p.alergenos.some((a) => sinAlergenos.includes(a)),
  );
  const llamado = vista.avisos.includes("llamar");
  const cuentaPedida = vista.avisos.includes("cuenta");

  return (
    <div className="min-h-dvh bg-white pb-32" lang={idioma}>
      <header className="azulejo">
        <div className="bg-gradient-to-b from-transparent to-cobalto-oscuro/80 px-4 pt-4 pb-5 text-white">
          <div className="mb-6 flex min-h-9 justify-end">
            {vista.local.ingles && (
              <button
                type="button"
                onClick={() => setIdioma(idioma === "es" ? "en" : "es")}
                className="flex h-9 items-center gap-1.5 rounded-full bg-black/25 px-3 text-sm font-semibold backdrop-blur"
                lang={idioma === "es" ? "en" : "es"}
              >
                <Languages aria-hidden className="size-4" /> {t.cambiarIdioma}
              </button>
            )}
          </div>
          <p className="text-sm font-semibold opacity-90">{vista.mesa.nombre}</p>
          <h1 className="font-rotulo text-5xl leading-none font-bold drop-shadow">
            {vista.local.nombre}
          </h1>
          {!pedir && <p className="mt-2 text-sm">{t.pideAlCamarero}</p>}
          {llevar && (
            <p className="mt-2 flex items-center gap-1.5 font-semibold">
              <Clock aria-hidden className="size-4" /> {t.recogeA(llevar.recogida)}
            </p>
          )}
        </div>
      </header>

      {encargoListo && (
        <p
          role="status"
          className="mx-4 mt-4 rounded-xl bg-cuenta p-3 text-center text-lg font-semibold text-white"
        >
          {t.encargoListo}
        </p>
      )}
      {vista.ticket && verGracias && (!vista.cuenta || vista.cuenta.total === 0) && (
        <Gracias
          local={local}
          token={token}
          idioma={idioma}
          ticket={vista.ticket}
          correo={vista.local.ticketCorreo}
          resena={vista.local.resena}
          alCerrar={() => setVerGracias(false)}
        />
      )}

      <nav
        aria-label={t.secciones}
        className="sticky top-0 z-30 border-b border-zinc bg-white/95 backdrop-blur"
      >
        <ul className="flex gap-1 overflow-x-auto px-3 py-2">
          {vista.categorias.map((c) => (
            <li key={c.id}>
              <a
                href={`#cat-${c.id}`}
                className="block h-9 shrink-0 rounded-full bg-zinc-claro px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-zinc"
              >
                {en(idioma, c.nombre, c.nombreEn)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <details className="mx-4 mt-4 rounded-xl bg-zinc-claro p-3 text-sm">
        <summary className="cursor-pointer font-semibold">
          {t.alergias}
          {sinAlergenos.length ? t.ocultando(sinAlergenos.length) : ""}
        </summary>
        <p className="mt-2 mb-2 text-tinta-suave">{t.alergiasAyuda}</p>
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
                {activo ? t.sin : ""}
                {nombreAlergeno(a)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-tinta-suave">{t.alergiaGrave}</p>
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
                {en(idioma, c.nombre, c.nombreEn)}
              </h2>
              <ul className="divide-y divide-zinc">
                {productos.map((p) => {
                  const nombre = en(idioma, p.nombre, p.nombreEn);
                  const descripcion = en(idioma, p.descripcion, p.descripcionEn);
                  return (
                    <li
                      key={p.id}
                      className={clsx("flex gap-3 py-3", !p.disponible && "opacity-50")}
                    >
                      {p.foto && (
                        // Fotos que suben los bares a su almacenamiento; tamaño ya reducido al subir.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.foto}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-20 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg leading-tight font-semibold">{nombre}</h3>
                        {descripcion && <p className="text-sm text-tinta-suave">{descripcion}</p>}
                        {p.alergenos.length > 0 && (
                          <p className="mt-1 text-xs text-tinta-suave">
                            {t.contiene}
                            {p.alergenos.map(nombreAlergeno).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-rotulo text-xl font-bold">{euros(p.precio)}</span>
                        {!p.disponible ? (
                          <span className="text-sm font-semibold">{t.agotado}</span>
                        ) : pedir ? (
                          <button
                            type="button"
                            onClick={() =>
                              p.grupos.length
                                ? setDetalle(p)
                                : añadir({ productoId: p.id, cantidad: 1, opciones: [], nota: "" })
                            }
                            className="flex h-10 items-center gap-1 rounded-full bg-cobalto px-4 text-sm font-semibold text-white active:scale-95"
                            aria-label={t.añadirA(nombre)}
                          >
                            <Plus aria-hidden className="size-4" /> {t.añadir}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className="py-8 text-center text-xs text-tinta-suave">{t.preciosIva}</p>
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
          {!llevar && (
            <Boton
              disabled={llamado || enviando}
              onClick={async () => {
                if (await mandar({ tipo: "llamar_camarero" })) avisar(t.avisado);
              }}
            >
              {llamado ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Bell aria-hidden className="size-4" />
              )}
              {llamado ? t.yaViene : t.llamar}
            </Boton>
          )}
          <Boton
            className={clsx(llevar && "col-span-2")}
            disabled={!vista.cuenta}
            onClick={() => setVerCuenta(true)}
          >
            <Receipt aria-hidden className="size-4" />{" "}
            {vista.cuenta ? `${t.miCuenta} · ${euros(vista.cuenta.total)}` : t.miCuenta}
          </Boton>
          {pedir && unidadesCesta > 0 && (
            <Boton
              variante="primario"
              tamano="grande"
              className="col-span-2"
              onClick={() => setVerCesta(true)}
            >
              <ShoppingBag aria-hidden className="size-5" /> {t.verPedido(unidadesCesta)} ·{" "}
              {euros(totalCesta)}
            </Boton>
          )}
        </div>
      </div>

      {detalle && (
        <Opciones
          producto={detalle}
          idioma={idioma}
          alCerrar={() => setDetalle(null)}
          alAñadir={(l) => {
            añadir(l);
            setDetalle(null);
          }}
        />
      )}

      <Dialogo abierto={verCesta} alCerrar={() => setVerCesta(false)} titulo={t.tuPedido}>
        <ul className="mb-4 divide-y divide-zinc">
          {cesta.map((l) => {
            const p = porId.get(l.productoId);
            if (!p) return null;
            const nombre = en(idioma, p.nombre, p.nombreEn);
            const opciones = p.grupos
              .flatMap((g) => g.opciones)
              .filter((o) => l.opciones.includes(o.id));
            return (
              <li key={l.clave} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nombre}</p>
                  {opciones.length > 0 && (
                    <p className="text-sm text-tinta-suave">
                      {opciones.map((o) => en(idioma, o.nombre, o.nombreEn)).join(", ")}
                    </p>
                  )}
                  {l.nota && <p className="text-sm text-tinta-suave">«{l.nota}»</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-full p-2 ring-1 ring-zinc-oscuro"
                    aria-label={t.quitarUna(nombre)}
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
                    aria-label={t.unaMas(nombre)}
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
          <span>{t.total}</span>
          <span>{euros(totalCesta)}</span>
        </p>
        <Boton
          variante="primario"
          tamano="grande"
          className="w-full"
          disabled={!cesta.length || enviando}
          onClick={enviarPedido}
        >
          {t.enviarPedido}
        </Boton>
        <p className="mt-2 text-center text-xs text-tinta-suave">
          {llevar
            ? `${t.comoVaEncargo(vista.local.confirmarPedidos)} ${vista.local.pagoQR ? "" : t.pagasAlRecoger}`
            : t.comoVa(vista.local.confirmarPedidos)}
        </p>
      </Dialogo>

      <Dialogo abierto={verCuenta} alCerrar={() => setVerCuenta(false)} titulo={t.tuCuenta}>
        {vista.cuenta && (
          <>
            <ul className="mb-3 divide-y divide-zinc">
              {vista.cuenta.lineas.map((l) => (
                <li
                  key={l.id}
                  className={clsx(
                    "flex items-start justify-between gap-2 py-2",
                    l.pagada && "opacity-60",
                  )}
                >
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
                      {t.estado[l.estado]}
                      {l.pagada && ` · ${t.pagado}`}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {l.invitacion
                      ? t.invitaLaCasa
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
            {vista.cuenta.pagado > 0 && (
              <p className="flex justify-between text-sm text-cuenta">
                <span>{t.yaPagado}</span>
                <span>{euros(vista.cuenta.pagado)}</span>
              </p>
            )}
            <p className="mb-4 flex justify-between text-xl font-semibold">
              <span>{vista.cuenta.pagado > 0 ? t.pendiente : t.total}</span>
              <span>{euros(vista.cuenta.total)}</span>
            </p>
            {vista.local.pagoQR && vista.cuenta.total > 0 && (
              <div className="mb-4">
                {vista.cuenta.aPagar > 0 ? (
                  <>
                    <Boton
                      variante="exito"
                      tamano="grande"
                      className="w-full"
                      disabled={pagando}
                      onClick={pagarConTarjeta}
                    >
                      <CreditCard aria-hidden className="size-5" />
                      {t.pagarAhora(euros(vista.cuenta.aPagar))}
                    </Boton>
                    <p className="mt-1 text-center text-xs text-tinta-suave">{t.pagoSeguro}</p>
                  </>
                ) : (
                  <p className="text-center text-sm text-tinta-suave">{t.esperaAceptar}</p>
                )}
              </div>
            )}
            {llevar ? (
              vista.cuenta.total > 0 &&
              !vista.local.pagoQR && (
                <p className="rounded-lg bg-zinc-claro p-3 text-center font-semibold">
                  {t.pagasAlRecoger}
                </p>
              )
            ) : cuentaPedida ? (
              <p className="rounded-lg bg-cuenta-claro p-3 text-center font-semibold">
                {t.cuentaPedida}
              </p>
            ) : (
              <>
                <p className="mb-2 font-semibold">{t.pedirCuenta}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["tarjeta", "efectivo", "bizum"] as const).map((m) => (
                    <Boton
                      key={m}
                      disabled={enviando}
                      onClick={async () => {
                        if (await mandar({ tipo: "pedir_cuenta", metodo: m }))
                          avisar(t.traenCuenta);
                      }}
                    >
                      {t.metodo[m]}
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

/** Después de pagar: el ticket por correo y la invitación a dejar una reseña. */
function Gracias({
  local,
  token,
  idioma,
  ticket,
  correo: conCorreo,
  resena,
  alCerrar,
}: {
  local: string;
  token: string;
  idioma: Idioma;
  ticket: NonNullable<VistaCliente["ticket"]>;
  correo: boolean;
  resena: string | null;
  alCerrar: () => void;
}) {
  const t = TEXTOS[idioma];
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"" | "mandando" | "hecho" | string>("");

  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("mandando");
    try {
      const r = await fetch(`/api/mesa/${local}/${token}/correo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const datos = (await r.json()) as { error?: string };
      setEstado(datos.error ?? "hecho");
    } catch {
      setEstado(t.sinConexion);
    }
  }

  return (
    <section
      aria-labelledby="titulo-gracias"
      className="relative mx-4 mt-4 rounded-2xl bg-cuenta-claro p-4 ring-2 ring-cuenta"
    >
      <button
        type="button"
        onClick={alCerrar}
        className="absolute top-2 right-2 rounded-lg p-2 hover:bg-white/60"
        aria-label="Cerrar"
      >
        <X aria-hidden className="size-4" />
      </button>
      <h2 id="titulo-gracias" className="font-rotulo text-2xl font-bold">
        {t.gracias}
      </h2>
      <p className="mb-3 text-sm">{t.pagadoTicket(ticket.numero, euros(ticket.total))}</p>
      {conCorreo &&
        (estado === "hecho" ? (
          <p role="status" className="mb-3 font-semibold">
            {t.mandado}
          </p>
        ) : (
          <form onSubmit={mandar} className="mb-3">
            <label className="mb-1 block text-sm font-semibold" htmlFor="correo-ticket">
              {t.ticketPorCorreo}
            </label>
            <div className="flex gap-2">
              <input
                id="correo-ticket"
                type="email"
                required
                autoComplete="email"
                className={claseEntrada}
                placeholder={t.tuCorreo}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              <Boton type="submit" disabled={estado === "mandando"}>
                <Mail aria-hidden className="size-4" /> {t.mandar}
              </Boton>
            </div>
            <p className="mt-1 text-xs text-tinta-suave">{t.noGuardamos}</p>
            {estado && estado !== "mandando" && (
              <p role="alert" className="mt-1 text-sm font-semibold text-aviso">
                {estado}
              </p>
            )}
          </form>
        ))}
      {resena && (
        <a
          href={resena}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-cobalto px-4 font-semibold text-white"
        >
          <Star aria-hidden className="size-4" /> {t.dejarResena}
        </a>
      )}
    </section>
  );
}

function Opciones({
  producto,
  idioma,
  alCerrar,
  alAñadir,
}: {
  producto: Producto;
  idioma: Idioma;
  alCerrar: () => void;
  alAñadir: (l: LineaPedida) => void;
}) {
  const t = TEXTOS[idioma];
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const faltan = producto.grupos.filter(
    (g) => g.obligatorio && !g.opciones.some((o) => elegidas.includes(o.id)),
  );
  const descripcion = en(idioma, producto.descripcion, producto.descripcionEn);

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo={en(idioma, producto.nombre, producto.nombreEn)}>
      {producto.foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.foto}
          alt=""
          className="mb-3 aspect-[4/3] w-full rounded-xl object-cover"
        />
      )}
      {descripcion && <p className="mb-3 text-tinta-suave">{descripcion}</p>}
      {producto.grupos.map((g) => (
        <fieldset key={g.id} className="mb-4">
          <legend className="mb-2 font-semibold">
            {en(idioma, g.nombre, g.nombreEn)}{" "}
            <span className="text-sm font-normal text-tinta-suave">
              {g.obligatorio ? t.eligeUna : t.opcional}
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
                  {en(idioma, o.nombre, o.nombreEn)}
                  {o.suplemento > 0 && ` +${euros(o.suplemento)}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Campo etiqueta={t.algoQueSaber} className="mb-4">
        <input
          className={claseEntrada}
          value={nota}
          maxLength={140}
          onChange={(e) => setNota(e.target.value)}
          placeholder={t.notaEjemplo}
        />
      </Campo>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full p-2.5 ring-1 ring-zinc-oscuro"
            aria-label={t.unaMenos}
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
            aria-label={t.otraMas}
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
          {t.añadir} · {euros(precioDe(producto, elegidas) * cantidad)}
        </Boton>
      </div>
    </Dialogo>
  );
}
