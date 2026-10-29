"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Check,
  ChefHat,
  Gift,
  Minus,
  Plus,
  Percent,
  Printer,
  MonitorSmartphone,
  QrCode,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Vacio } from "@/components/ui";
import {
  euros,
  importeLinea,
  lineasCobrables,
  pagadoCuenta,
  precioConOpciones,
  subtotalCuenta,
  totalCuenta,
} from "@/lib/dominio/importes";
import type { Cuenta, EstadoLinea, LineaCuenta } from "@/lib/dominio/tipos";
import { formatearHora, minutosEntre } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";
import { CartaTpv } from "@/components/carta-tpv";
import { buscarMesa, esParaLlevar } from "@/lib/dominio/selectores";
import { Cobrar } from "./cobrar";
import { PreciosYDescuentos } from "./precios";

const TEXTO_ESTADO: Record<EstadoLinea, string> = {
  por_confirmar: "Por aceptar",
  anotada: "Sin mandar",
  enviada: "Preparando",
  lista: "Listo",
  servida: "Servido",
  anulada: "Anulado",
  en_espera: "Para después",
};

/**
 * La cuenta de una mesa. `alSalir`, si viene, sustituye a volver a /sala (sin red no se puede
 * navegar: la sala abre la mesa dentro de sí misma).
 */
export function Comanda({ mesaId, alSalir }: { mesaId: string; alSalir?: () => void }) {
  const { estado, hacer } = useDatos();
  const paraDespues = useFuncion("paraDespues");
  const porPartes = useFuncion("cobrarPorPartes");
  const propinas = useFuncion("propinas");
  const router = useRouter();
  const salir = () => (alSalir ? alSalir() : router.push("/sala"));
  const mesa = buscarMesa(estado, mesaId);
  const cuenta = estado.cuentas.find((c) => c.mesaId === mesaId && c.estado === "abierta");
  // Si hay un pedido del QR por aceptar, en el móvil se abre directamente la cuenta.
  const [panel, setPanel] = useState<"carta" | "cuenta">(() =>
    cuenta?.lineas.some((l) => l.estado === "por_confirmar") ? "cuenta" : "carta",
  );
  const [dialogo, setDialogo] = useState<null | "cobrar" | "mover" | "precios" | "anular">(null);
  const [preseleccion, setPreseleccion] = useState<string[]>([]);
  const abrirPrecios = (lineaIds: string[] = []) => {
    setPreseleccion(lineaIds);
    setDialogo("precios");
  };
  // Si la comanda sale en papel: lo que diga Ajustes, y se puede cambiar en cada envío.
  const [enPapel, setEnPapel] = useState(estado.ajustes.imprimirComandas ?? true);
  const mandar = () =>
    hacer(
      { tipo: "enviar_comanda", cuentaId: cuenta!.id, imprimir: enPapel },
      enPapel ? "Comanda mandada" : "Mandada a pantalla (sin papel)",
    );

  if (!mesa)
    return (
      <main className="p-6">
        <Vacio
          titulo={esParaLlevar(mesaId) ? "Este encargo ya está cerrado" : "Esta mesa ya no existe"}
        >
          <Link href="/sala" className="font-semibold text-cobalto underline">
            Volver a la sala
          </Link>
        </Vacio>
      </main>
    );
  if (!cuenta)
    return (
      <main className="mx-auto max-w-md p-6">
        <Vacio
          titulo={
            esParaLlevar(mesaId) ? "Este encargo ya está cerrado" : `${mesa.nombre} está libre`
          }
        >
          <p className="mb-4">La cuenta se ha cobrado o cerrado desde otra pantalla.</p>
          <button type="button" onClick={salir} className="font-semibold text-cobalto underline">
            Volver a la sala
          </button>
        </Vacio>
      </main>
    );

  const sinMandar = cuenta.lineas.filter((l) => l.estado === "anotada");
  const porAceptar = cuenta.lineas.filter((l) => l.estado === "por_confirmar");
  const enEspera = cuenta.lineas.filter((l) => l.estado === "en_espera");
  const pagado = pagadoCuenta(cuenta);
  const unidades = (ls: LineaCuenta[]) => ls.reduce((s, l) => s + l.cantidad, 0);

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col lg:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-oscuro/50 bg-white px-3 py-2">
        {alSalir ? (
          <button
            type="button"
            onClick={alSalir}
            className="rounded-lg p-2 hover:bg-zinc"
            aria-label="Volver a la sala"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </button>
        ) : (
          <Link href="/sala" className="rounded-lg p-2 hover:bg-zinc" aria-label="Volver a la sala">
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
        )}
        <h1 className="font-rotulo text-3xl font-bold">{mesa.nombre}</h1>
        {cuenta.llevar?.telefono && (
          <a
            href={`tel:${cuenta.llevar.telefono.replace(/\s/g, "")}`}
            className="text-sm underline"
          >
            {cuenta.llevar.telefono}
          </a>
        )}
        <div
          className={clsx(
            "flex items-center gap-1 rounded-lg bg-zinc-claro px-1 ring-1 ring-zinc",
            cuenta.llevar && "hidden",
          )}
        >
          <button
            type="button"
            className="p-2"
            aria-label="Una persona menos"
            disabled={cuenta.comensales <= 1}
            onClick={() =>
              hacer({
                tipo: "cambiar_comensales",
                cuentaId: cuenta.id,
                comensales: cuenta.comensales - 1,
              })
            }
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <span className="flex items-center gap-1 font-semibold">
            <Users aria-hidden className="size-4" /> {cuenta.comensales}
            <span className="sr-only">personas</span>
          </span>
          <button
            type="button"
            className="p-2"
            aria-label="Una persona más"
            onClick={() =>
              hacer({
                tipo: "cambiar_comensales",
                cuentaId: cuenta.id,
                comensales: cuenta.comensales + 1,
              })
            }
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        <p className="text-sm text-tinta-suave">
          Abierta a las {formatearHora(cuenta.abiertaEn)}
          {cuenta.empleadoId &&
            ` · ${estado.empleados.find((e) => e.id === cuenta.empleadoId)?.nombre ?? ""}`}
        </p>
        <div className="ml-auto flex flex-wrap gap-1">
          {!cuenta.llevar && (
            <Boton tamano="pequeno" variante="fantasma" onClick={() => setDialogo("mover")}>
              <ArrowRightLeft aria-hidden className="size-4" /> Mover o juntar
            </Boton>
          )}
          <Boton tamano="pequeno" variante="fantasma" onClick={() => abrirPrecios()}>
            <Percent aria-hidden className="size-4" /> Precios y descuentos
          </Boton>
          <Boton tamano="pequeno" variante="fantasma" onClick={() => setDialogo("anular")}>
            <Ban aria-hidden className="size-4" />{" "}
            {cuenta.llevar ? "Anular encargo" : "Anular mesa"}
          </Boton>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Panel"
        className="grid grid-cols-2 border-b border-zinc-oscuro/50 bg-white lg:hidden"
      >
        {(["carta", "cuenta"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={panel === p}
            onClick={() => setPanel(p)}
            className={clsx(
              "h-11 font-semibold",
              panel === p ? "border-b-3 border-cobalto text-cobalto" : "text-tinta-suave",
            )}
          >
            {p === "carta" ? "Carta" : `Cuenta · ${euros(totalCuenta(cuenta))}`}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_26rem]">
        <section
          aria-label="Carta"
          className={clsx("min-h-0 overflow-y-auto p-3", panel !== "carta" && "hidden lg:block")}
        >
          <CartaTpv
            permitirDespues={paraDespues}
            alAnotar={(linea) => hacer({ tipo: "anotar", cuentaId: cuenta.id, lineas: [linea] })}
          />
          <div className="sticky bottom-0 -mx-3 mt-3 grid grid-cols-2 gap-2 border-t border-zinc-oscuro/50 bg-zinc-claro p-3 lg:hidden">
            <Boton onClick={() => setPanel("cuenta")}>
              Ver cuenta · {euros(totalCuenta(cuenta))}
            </Boton>
            <Boton variante="primario" disabled={!sinMandar.length} onClick={mandar}>
              <ChefHat aria-hidden className="size-5" />
              Mandar{sinMandar.length ? ` (${unidades(sinMandar)})` : ""}
            </Boton>
          </div>
        </section>
        <section
          aria-label="Cuenta"
          className={clsx(
            "flex min-h-0 flex-col border-zinc-oscuro/50 bg-white lg:border-l",
            panel !== "cuenta" && "hidden lg:flex",
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {porAceptar.length > 0 && (
              <div className="mb-4 rounded-xl bg-qr-claro p-3 ring-2 ring-qr">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <QrCode aria-hidden className="size-5" /> Pedido desde el QR (
                  {unidades(porAceptar)})
                </p>
                <Lineas cuenta={cuenta} lineas={porAceptar} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Boton
                    variante="secundario"
                    onClick={() =>
                      hacer({ tipo: "rechazar_pedido_qr", cuentaId: cuenta.id }, "Pedido rechazado")
                    }
                  >
                    <X aria-hidden className="size-4" /> Rechazar
                  </Boton>
                  <Boton
                    variante="primario"
                    onClick={() =>
                      hacer(
                        { tipo: "aceptar_pedido_qr", cuentaId: cuenta.id },
                        "Mandado a cocina y barra",
                      )
                    }
                  >
                    <Check aria-hidden className="size-4" /> Aceptar y mandar
                  </Boton>
                </div>
              </div>
            )}
            {cuenta.lineas.length === 0 ? (
              <Vacio titulo="Cuenta vacía">Toca un producto de la carta para anotarlo.</Vacio>
            ) : (
              <Lineas
                cuenta={cuenta}
                lineas={cuenta.lineas.filter((l) => l.estado !== "por_confirmar")}
                alTocarPrecio={(id) => abrirPrecios([id])}
              />
            )}
          </div>

          <footer className="border-t border-zinc-oscuro/50 p-3">
            {(cuenta.descuento > 0 || Boolean(cuenta.descuentoImporte)) && (
              <button
                type="button"
                onClick={() => abrirPrecios()}
                className="flex w-full justify-between text-sm text-tinta-suave hover:underline"
              >
                <span>Subtotal {euros(subtotalCuenta(cuenta))}</span>
                <span>
                  Descuento{" "}
                  {[
                    cuenta.descuento ? `${cuenta.descuento} %` : "",
                    cuenta.descuentoImporte ? euros(cuenta.descuentoImporte) : "",
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                </span>
              </button>
            )}
            {pagado > 0 && (
              <p className="flex justify-between text-sm text-cuenta">
                <span>Ya pagado</span>
                <span className="font-semibold">{euros(pagado)}</span>
              </p>
            )}
            {enEspera.length > 0 && (
              <Boton
                variante="secundario"
                className="mb-2 w-full ring-2 ring-qr"
                onClick={() =>
                  hacer({ tipo: "marchar", cuentaId: cuenta.id }, "¡Marcha! Mandado a preparar")
                }
              >
                Marcha · {unidades(enEspera)} para después
              </Boton>
            )}
            <p className="mb-3 flex items-baseline justify-between">
              <span className="font-semibold">{pagado > 0 ? "Pendiente" : "Total"}</span>
              <span className="font-rotulo text-4xl font-bold">{euros(totalCuenta(cuenta))}</span>
            </p>
            <button
              type="button"
              aria-pressed={enPapel}
              onClick={() => setEnPapel((v) => !v)}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-tinta-suave"
            >
              {enPapel ? (
                <Printer aria-hidden className="size-4" />
              ) : (
                <MonitorSmartphone aria-hidden className="size-4" />
              )}
              Comanda en papel: {enPapel ? "sí" : "no, solo en pantalla"}
              <span className="font-normal underline">cambiar</span>
            </button>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
              <Boton
                aria-label="Imprimir la cuenta"
                onClick={() =>
                  hacer(
                    { tipo: "imprimir_precuenta", cuentaId: cuenta.id },
                    "Cuenta mandada a imprimir",
                  )
                }
              >
                <Printer aria-hidden className="size-5" />
              </Boton>
              <Boton
                variante="primario"
                tamano="grande"
                disabled={!sinMandar.length}
                onClick={mandar}
              >
                <ChefHat aria-hidden className="size-5" />
                Mandar{sinMandar.length ? ` (${unidades(sinMandar)})` : ""}
              </Boton>
              <Boton variante="exito" tamano="grande" onClick={() => setDialogo("cobrar")}>
                Cobrar
              </Boton>
            </div>
          </footer>
        </section>
      </div>

      <Cobrar
        abierto={dialogo === "cobrar"}
        lineas={lineasCobrables(cuenta)}
        descuento={cuenta.descuento}
        descuentoImporte={cuenta.descuentoImporte ?? 0}
        alAjustar={() => {
          setDialogo(null);
          abrirPrecios();
        }}
        comensales={cuenta.comensales}
        permitirPartes={porPartes}
        permitirPropina={propinas}
        alCerrar={() => setDialogo(null)}
        cobrar={async ({ pagos, propina, partes }, mensaje) => {
          const ok = await hacer(
            { tipo: "cobrar", cuentaId: cuenta.id, pagos, propina, partes },
            mensaje,
          );
          // Si queda algo por pagar, la mesa sigue abierta.
          if (ok && !partes) salir();
          return ok;
        }}
      />
      <Mover abierto={dialogo === "mover"} cuenta={cuenta} alCerrar={() => setDialogo(null)} />
      <PreciosYDescuentos
        abierto={dialogo === "precios"}
        cuenta={cuenta}
        preseleccion={preseleccion}
        alCerrar={() => setDialogo(null)}
      />
      <Dialogo
        abierto={dialogo === "anular"}
        alCerrar={() => setDialogo(null)}
        titulo="Anular la mesa"
      >
        <p className="mb-4">
          Se anula todo lo de {mesa.nombre} y la mesa queda libre. No sale ticket. Si ya se ha
          servido algo, mejor cóbralo o invítalo.
        </p>
        <div className="flex justify-end gap-2">
          <Boton onClick={() => setDialogo(null)}>No, volver</Boton>
          <Boton
            variante="peligro"
            onClick={async () => {
              if (await hacer({ tipo: "anular_cuenta", cuentaId: cuenta.id }, "Mesa anulada"))
                salir();
            }}
          >
            Anular la mesa
          </Boton>
        </div>
      </Dialogo>
    </main>
  );
}

function Lineas({
  cuenta,
  lineas,
  alTocarPrecio,
}: {
  cuenta: Cuenta;
  lineas: LineaCuenta[];
  /** Tocar el importe de una línea abre «Precios y descuentos» con ella marcada. */
  alTocarPrecio?: (lineaId: string) => void;
}) {
  const { hacer } = useDatos();
  const paraDespues = useFuncion("paraDespues");
  const ahora = useAhora();
  const [anulando, setAnulando] = useState<LineaCuenta | null>(null);
  const [motivo, setMotivo] = useState("");

  return (
    <>
      <ul className="divide-y divide-zinc">
        {lineas.map((l) => {
          const editable = l.estado === "anotada";
          const anulada = l.estado === "anulada";
          return (
            <li key={l.id} className={clsx("py-2", anulada && "opacity-50")}>
              <div className="flex items-start gap-2">
                <span className="w-7 shrink-0 text-right font-rotulo text-xl font-bold">
                  {l.cantidad}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={clsx("font-semibold", anulada && "line-through")}>{l.nombre}</p>
                  {l.opciones.length > 0 && (
                    <p className="text-sm text-tinta-suave">
                      {l.opciones.map((o) => o.nombre).join(", ")}
                    </p>
                  )}
                  {l.nota && <p className="text-sm font-medium text-aviso">«{l.nota}»</p>}
                  <p
                    className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-tinta-suave"
                    suppressHydrationWarning
                  >
                    <EtiquetaEstado estado={l.estado} />
                    {l.ticketId && (
                      <span className="rounded bg-cuenta-claro px-1.5 py-0.5 font-semibold text-cuenta">
                        Pagado
                      </span>
                    )}
                    {l.estado === "anotada" && l.despues && (
                      <span className="rounded bg-qr-claro px-1.5 py-0.5 font-semibold text-qr">
                        Para después
                      </span>
                    )}
                    {l.origen === "qr" && <span>QR</span>}
                    {l.enviadaEn && l.estado === "enviada" && (
                      <span>hace {minutosEntre(l.enviadaEn, ahora)} min</span>
                    )}
                    {l.invitacion && <span className="font-semibold text-cuenta">Invitación</span>}
                    {l.descuentoLinea ? (
                      <span className="font-semibold text-cuenta">−{l.descuentoLinea} %</span>
                    ) : null}
                    {l.precioCambiado !== undefined && (
                      <span className="font-semibold">Precio cambiado</span>
                    )}
                    {l.motivoAnulacion && <span>{l.motivoAnulacion}</span>}
                  </p>
                </div>
                {anulada ? (
                  <span className="shrink-0 font-semibold">—</span>
                ) : alTocarPrecio && !l.ticketId && l.estado !== "por_confirmar" ? (
                  <button
                    type="button"
                    onClick={() => alTocarPrecio(l.id)}
                    className="shrink-0 rounded-md px-1 text-right font-semibold tabular-nums underline decoration-dotted underline-offset-4 hover:bg-zinc"
                    aria-label={`${euros(importeLinea(l))}. Cambiar precio o descuento de ${l.nombre}`}
                  >
                    {euros(importeLinea(l))}
                    {(l.precioCambiado !== undefined || Boolean(l.descuentoLinea)) && (
                      <span className="block text-xs font-normal text-tinta-suave line-through">
                        {euros(precioConOpciones(l) * l.cantidad)}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="shrink-0 font-semibold tabular-nums">
                    {euros(importeLinea(l))}
                  </span>
                )}
              </div>
              {l.estado !== "por_confirmar" && !anulada && !l.ticketId && (
                <div className="mt-1 flex flex-wrap justify-end gap-1 pl-9">
                  {editable ? (
                    <>
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        aria-label={`Una ${l.nombre} menos`}
                        onClick={() =>
                          l.cantidad > 1
                            ? hacer({
                                tipo: "cambiar_cantidad",
                                cuentaId: cuenta.id,
                                lineaId: l.id,
                                cantidad: l.cantidad - 1,
                              })
                            : hacer({ tipo: "quitar_linea", cuentaId: cuenta.id, lineaId: l.id })
                        }
                      >
                        <Minus aria-hidden className="size-4" />
                      </Boton>
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        aria-label={`Una ${l.nombre} más`}
                        onClick={() =>
                          hacer({
                            tipo: "cambiar_cantidad",
                            cuentaId: cuenta.id,
                            lineaId: l.id,
                            cantidad: l.cantidad + 1,
                          })
                        }
                      >
                        <Plus aria-hidden className="size-4" />
                      </Boton>
                      {(paraDespues || l.despues) && (
                        <Boton
                          tamano="pequeno"
                          variante="fantasma"
                          aria-pressed={Boolean(l.despues)}
                          onClick={() =>
                            hacer({
                              tipo: "cambiar_despues",
                              cuentaId: cuenta.id,
                              lineaId: l.id,
                              despues: !l.despues,
                            })
                          }
                        >
                          {l.despues ? "Ahora" : "Después"}
                        </Boton>
                      )}
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        aria-label={`Quitar ${l.nombre}`}
                        onClick={() =>
                          hacer({ tipo: "quitar_linea", cuentaId: cuenta.id, lineaId: l.id })
                        }
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Boton>
                    </>
                  ) : (
                    <>
                      {l.estado === "lista" && (
                        <Boton
                          tamano="pequeno"
                          variante="exito"
                          onClick={() =>
                            hacer({ tipo: "marcar_servida", cuentaId: cuenta.id, lineaIds: [l.id] })
                          }
                        >
                          Servido
                        </Boton>
                      )}
                      <Boton tamano="pequeno" variante="fantasma" onClick={() => setAnulando(l)}>
                        Anular
                      </Boton>
                    </>
                  )}
                  <Boton
                    tamano="pequeno"
                    variante="fantasma"
                    aria-pressed={l.invitacion}
                    onClick={() =>
                      hacer({
                        tipo: "invitar_linea",
                        cuentaId: cuenta.id,
                        lineaId: l.id,
                        invitacion: !l.invitacion,
                      })
                    }
                  >
                    <Gift aria-hidden className="size-4" /> {l.invitacion ? "Cobrar" : "Invitar"}
                  </Boton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Dialogo
        abierto={anulando !== null}
        alCerrar={() => setAnulando(null)}
        titulo={`Anular ${anulando?.nombre ?? ""}`}
      >
        <p className="mb-3 text-sm text-tinta-suave">
          Ya está en cocina o barra. Queda apuntado quién lo anula y por qué.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {["Error al pedir", "El cliente lo cancela", "Se ha caído", "Tarda demasiado"].map(
            (m) => (
              <Boton
                key={m}
                tamano="pequeno"
                variante={motivo === m ? "primario" : "secundario"}
                onClick={() => setMotivo(m)}
              >
                {m}
              </Boton>
            ),
          )}
        </div>
        <Campo etiqueta="Motivo" className="mb-4">
          <input
            className={claseEntrada}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={140}
          />
        </Campo>
        <div className="flex justify-end">
          <Boton
            variante="peligro"
            disabled={!motivo.trim()}
            onClick={async () => {
              if (
                anulando &&
                (await hacer({
                  tipo: "anular_linea",
                  cuentaId: cuenta.id,
                  lineaId: anulando.id,
                  motivo: motivo.trim(),
                }))
              ) {
                setAnulando(null);
                setMotivo("");
              }
            }}
          >
            Anular
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}

function EtiquetaEstado({ estado }: { estado: EstadoLinea }) {
  return (
    <span
      className={clsx(
        "rounded px-1.5 py-0.5 font-semibold",
        estado === "anotada" && "bg-ocupada-claro text-tinta",
        estado === "por_confirmar" && "bg-qr text-white",
        estado === "enviada" && "bg-cobalto-claro text-cobalto-oscuro",
        estado === "lista" && "bg-cuenta text-white",
        estado === "servida" && "bg-zinc text-tinta-suave",
        estado === "anulada" && "bg-zinc text-tinta-suave",
        estado === "en_espera" && "bg-qr-claro text-qr",
      )}
    >
      {TEXTO_ESTADO[estado]}
    </span>
  );
}

function Mover({
  abierto,
  cuenta,
  alCerrar,
}: {
  abierto: boolean;
  cuenta: Cuenta;
  alCerrar: () => void;
}) {
  const { estado, hacer } = useDatos();
  const router = useRouter();
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Mover o juntar mesa" ancho="max-w-2xl">
      <p className="mb-3 text-sm text-tinta-suave">
        Elige la mesa de destino. Si está ocupada, las dos cuentas se juntan en una.
      </p>
      {[...estado.zonas]
        .sort((a, b) => a.orden - b.orden)
        .map((z) => (
          <div key={z.id} className="mb-3">
            <p className="mb-1 font-semibold">{z.nombre}</p>
            <div className="flex flex-wrap gap-2">
              {estado.mesas
                .filter((m) => m.zonaId === z.id && m.id !== cuenta.mesaId)
                .map((m) => {
                  const ocupada = estado.cuentas.some(
                    (c) => c.mesaId === m.id && c.estado === "abierta",
                  );
                  return (
                    <Boton
                      key={m.id}
                      variante={ocupada ? "secundario" : "primario"}
                      onClick={async () => {
                        if (
                          await hacer(
                            { tipo: "mover_cuenta", cuentaId: cuenta.id, mesaId: m.id },
                            ocupada ? `Juntada con ${m.nombre}` : `Movida a ${m.nombre}`,
                          )
                        ) {
                          alCerrar();
                          router.replace(`/sala/${m.id}`);
                        }
                      }}
                    >
                      {m.nombre}
                      {ocupada && " (juntar)"}
                    </Boton>
                  );
                })}
            </div>
          </div>
        ))}
    </Dialogo>
  );
}
