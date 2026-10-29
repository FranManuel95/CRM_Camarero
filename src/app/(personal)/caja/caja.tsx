"use client";

import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, Lock, Printer, Unlock } from "lucide-react";
import { useState } from "react";
import { useAlertas } from "@/components/alertas";
import { useDatos, useFuncion, usePuede } from "@/components/datos-personal";
import { TicketPorCorreo } from "@/components/ticket-correo";
import { Boton, Campo, claseEntrada, Dialogo, Vacio } from "@/components/ui";
import { extrasDelTurno, resumenTurno, turnoAbierto, ticketsDelTurno } from "@/lib/dominio/caja";
import { buscarMesa } from "@/lib/dominio/selectores";
import { euros, leerEuros } from "@/lib/dominio/importes";
import { formatearFechaHora, formatearHora } from "@/lib/fechas";
import type { Ticket } from "@/lib/dominio/tipos";

const METODOS = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  bizum: "Bizum",
  otro: "Otro",
  fiado: "A deber",
} as const;

/** Monedas y billetes para contar el cajón al cerrar. */
const VALORES = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export function Caja() {
  const { estado, hacer, empleado } = useDatos();
  const puedeCaja = usePuede("caja");
  const turno = turnoAbierto(estado);
  const porCorreo = useFuncion("ticketCorreo");
  const [fondo, setFondo] = useState("150");
  const [movimiento, setMovimiento] = useState<null | "entrada" | "salida">(null);
  const [cerrando, setCerrando] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const cerrados = estado.turnos.filter((t) => t.cerradoEn).sort((a, b) => b.numero - a.numero);

  return (
    <main className="mx-auto grid max-w-screen-xl gap-6 p-3 sm:p-6 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby="titulo-caja">
        <h1 id="titulo-caja" className="mb-3 font-rotulo text-4xl font-bold">
          Caja
        </h1>
        {!turno ? (
          <div className="max-w-md rounded-2xl bg-white p-5 ring-1 ring-zinc">
            <p className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Lock aria-hidden className="size-5" /> La caja está cerrada
            </p>
            <Campo etiqueta="Fondo de caja (el cambio con el que empiezas)" className="mb-4">
              <input
                className={claseEntrada}
                inputMode="decimal"
                value={fondo}
                onChange={(e) => setFondo(e.target.value)}
              />
            </Campo>
            {!puedeCaja && (
              <p className="mb-3 text-sm text-tinta-suave">La caja la abre el encargado.</p>
            )}
            <Boton
              variante="primario"
              tamano="grande"
              className="w-full"
              disabled={leerEuros(fondo) === null || !puedeCaja}
              onClick={() =>
                hacer({ tipo: "abrir_caja", fondoInicial: leerEuros(fondo) ?? 0 }, "Caja abierta")
              }
            >
              <Unlock aria-hidden className="size-5" /> Abrir caja
            </Boton>
          </div>
        ) : (
          <TurnoAbierto
            alMovimiento={setMovimiento}
            alCerrar={() => setCerrando(true)}
            alVerTicket={setTicket}
          />
        )}
      </section>

      <aside aria-labelledby="titulo-cierres">
        <h2 id="titulo-cierres" className="mb-2 font-rotulo text-2xl font-bold">
          Cierres anteriores
        </h2>
        {cerrados.length === 0 ? (
          <Vacio titulo="Aún no hay cierres" />
        ) : (
          <ul className="space-y-2">
            {cerrados.slice(0, 20).map((t) => {
              const r = resumenTurno(estado, t);
              return (
                <li key={t.id} className="rounded-xl bg-white p-3 ring-1 ring-zinc">
                  <div className="flex items-baseline justify-between">
                    <p className="font-semibold">Z nº {t.numero}</p>
                    <p className="font-semibold">{euros(r.ventas)}</p>
                  </div>
                  <p className="text-sm text-tinta-suave">
                    {formatearFechaHora(t.abiertoEn)} –{" "}
                    {t.cerradoEn ? formatearHora(t.cerradoEn) : ""} · {r.tickets} tickets
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p
                      className={clsx(
                        "text-sm font-semibold",
                        (r.descuadre ?? 0) < 0 ? "text-aviso" : "text-cuenta",
                      )}
                    >
                      {r.descuadre === 0 ? "Cuadrada" : `Descuadre ${euros(r.descuadre ?? 0)}`}
                    </p>
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      onClick={() => hacer({ tipo: "reimprimir_cierre", turnoId: t.id })}
                    >
                      <Printer aria-hidden className="size-4" /> Reimprimir
                    </Boton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <Movimiento tipo={movimiento} alCerrar={() => setMovimiento(null)} />
      {turno && <Cierre abierto={cerrando} alCerrar={() => setCerrando(false)} />}
      <Dialogo
        abierto={ticket !== null}
        alCerrar={() => setTicket(null)}
        titulo={`Ticket ${ticket?.numero ?? ""}`}
      >
        {ticket && (
          <>
            <ul className="mb-3 divide-y divide-zinc">
              {ticket.lineas.map((l, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span>
                    {l.cantidad} {l.nombre}
                  </span>
                  <span className="tabular-nums">{euros(l.importe)}</span>
                </li>
              ))}
            </ul>
            <p className="mb-4 flex justify-between font-semibold">
              <span>Total · {ticket.pagos.map((p) => METODOS[p.metodo]).join(" + ")}</span>
              <span>{euros(ticket.total)}</span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {empleado.rol === "encargado" &&
                !ticket.rectificaA &&
                !estado.tickets.some((t) => t.rectificaA === ticket.id) && (
                  <Boton
                    variante="peligro"
                    onClick={async () => {
                      if (
                        await hacer(
                          { tipo: "rectificar_ticket", ticketId: ticket.id },
                          "Rectificativa hecha",
                        )
                      )
                        setTicket(null);
                    }}
                  >
                    Devolver (rectificativa)
                  </Boton>
                )}
              <Boton
                variante="primario"
                onClick={() => hacer({ tipo: "reimprimir_ticket", ticketId: ticket.id })}
              >
                <Printer aria-hidden className="size-4" /> Reimprimir
              </Boton>
            </div>
            {porCorreo && <TicketPorCorreo ticketId={ticket.id} />}
          </>
        )}
      </Dialogo>
    </main>
  );
}

function TurnoAbierto({
  alMovimiento,
  alCerrar,
  alVerTicket,
}: {
  alMovimiento: (t: "entrada" | "salida") => void;
  alCerrar: () => void;
  alVerTicket: (t: Ticket) => void;
}) {
  const { estado } = useDatos();
  const puedeCaja = usePuede("caja");
  const turno = turnoAbierto(estado)!;
  const r = resumenTurno(estado, turno);
  const tickets = ticketsDelTurno(estado, turno).slice().reverse();
  const abiertas = estado.cuentas.filter((c) => c.estado === "abierta").length;

  return (
    <>
      <div className="mb-4 rounded-2xl bg-white p-5 ring-1 ring-zinc">
        <p className="mb-3 text-sm text-tinta-suave">
          Turno nº {turno.numero} · abierto a las {formatearHora(turno.abiertoEn)} con{" "}
          {euros(turno.fondoInicial)} de fondo
        </p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dato titulo="Ventas" valor={euros(r.ventas)} grande />
          <Dato titulo="Tickets" valor={String(r.tickets)} />
          {r.propinas > 0 && <Dato titulo="Propinas" valor={euros(r.propinas)} />}
          <Dato
            titulo="Ticket medio"
            valor={r.tickets ? euros(Math.round(r.ventas / r.tickets)) : "—"}
          />
          <Dato titulo="En el cajón" valor={euros(r.efectivoEsperado)} />
          {(Object.keys(METODOS) as (keyof typeof METODOS)[]).map((m) =>
            r.porMetodo[m] ? (
              <Dato key={m} titulo={METODOS[m]} valor={euros(r.porMetodo[m])} />
            ) : null,
          )}
          {r.entradas > 0 && <Dato titulo="Entradas" valor={euros(r.entradas)} />}
          {r.salidas > 0 && <Dato titulo="Salidas" valor={`−${euros(r.salidas)}`} />}
        </dl>
        {puedeCaja && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Boton onClick={() => alMovimiento("entrada")}>
              <ArrowDownLeft aria-hidden className="size-4" /> Meter dinero
            </Boton>
            <Boton onClick={() => alMovimiento("salida")}>
              <ArrowUpRight aria-hidden className="size-4" /> Sacar dinero
            </Boton>
            <Boton variante="primario" className="ml-auto" onClick={alCerrar}>
              <Lock aria-hidden className="size-4" /> Cerrar caja (Z)
            </Boton>
          </div>
        )}
        {abiertas > 0 && (
          <p className="mt-3 text-sm text-tinta-suave">
            Quedan {abiertas} {abiertas === 1 ? "mesa abierta" : "mesas abiertas"}. Puedes cerrar
            igual: seguirán abiertas para el turno siguiente.
          </p>
        )}
      </div>

      {turno.movimientos.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 font-rotulo text-2xl font-bold">Movimientos</h2>
          <ul className="divide-y divide-zinc rounded-xl bg-white ring-1 ring-zinc">
            {turno.movimientos.map((m) => (
              <li key={m.id} className="flex justify-between px-3 py-2">
                <span>
                  {formatearHora(m.fecha)} · {m.motivo}
                </span>
                <span
                  className={clsx(
                    "font-semibold",
                    m.tipo === "salida" ? "text-aviso" : "text-cuenta",
                  )}
                >
                  {m.tipo === "salida" ? "−" : "+"}
                  {euros(m.importe)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 font-rotulo text-2xl font-bold">Tickets del turno</h2>
      {tickets.length === 0 ? (
        <Vacio titulo="Todavía no se ha cobrado nada" />
      ) : (
        <ul className="divide-y divide-zinc rounded-xl bg-white ring-1 ring-zinc">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => alVerTicket(t)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-claro"
              >
                <span className="w-14 text-sm text-tinta-suave">{formatearHora(t.fecha)}</span>
                <span className="flex-1">
                  <span className="font-semibold">{t.mesaNombre}</span>{" "}
                  <span className="text-sm text-tinta-suave">
                    {t.numero} · {t.pagos.map((p) => METODOS[p.metodo]).join(" + ")}
                    {t.rectificaA && " · rectificativa"}
                  </span>
                </span>
                <span className={clsx("font-semibold tabular-nums", t.total < 0 && "text-aviso")}>
                  {euros(t.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Dato({ titulo, valor, grande }: { titulo: string; valor: string; grande?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-tinta-suave">{titulo}</dt>
      <dd className={clsx("font-rotulo font-bold", grande ? "text-4xl" : "text-2xl")}>{valor}</dd>
    </div>
  );
}

function Movimiento({
  tipo,
  alCerrar,
}: {
  tipo: null | "entrada" | "salida";
  alCerrar: () => void;
}) {
  const { hacer } = useDatos();
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const valor = leerEuros(importe);
  return (
    <Dialogo
      abierto={tipo !== null}
      alCerrar={alCerrar}
      titulo={tipo === "entrada" ? "Meter dinero en la caja" : "Sacar dinero de la caja"}
    >
      <Campo etiqueta="Importe" className="mb-3">
        <input
          className={claseEntrada}
          inputMode="decimal"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
        />
      </Campo>
      <Campo
        etiqueta="Motivo"
        className="mb-4"
        ayuda={
          tipo === "salida"
            ? "Para pagar a un proveedor, mejor apúntalo en Gestión → Gastos con «pagado con la caja»."
            : undefined
        }
      >
        <input
          className={claseEntrada}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={tipo === "entrada" ? "Más cambio" : "Compra de hielo"}
        />
      </Campo>
      <Boton
        variante="primario"
        className="w-full"
        disabled={!valor || !motivo.trim()}
        onClick={async () => {
          if (
            tipo &&
            valor &&
            (await hacer(
              { tipo: "movimiento_caja", movimiento: tipo, importe: valor, motivo: motivo.trim() },
              "Apuntado",
            ))
          ) {
            setImporte("");
            setMotivo("");
            alCerrar();
          }
        }}
      >
        Apuntar
      </Boton>
    </Dialogo>
  );
}

/**
 * Cierre guiado en tres pasos: lo que queda pendiente, contar el cajón y el resumen del turno
 * antes de sacar el Z.
 */
function Cierre({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { estado, hacer } = useDatos();
  const alertas = useAlertas();
  const turno = turnoAbierto(estado)!;
  const r = resumenTurno(estado, turno);
  const extras = extrasDelTurno(estado, turno);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [cuenta, setCuenta] = useState<Record<number, string>>({});
  const [deGolpe, setDeGolpe] = useState("");
  const porMonedas = VALORES.reduce((s, v) => s + v * (Number(cuenta[v]) || 0), 0);
  const contado = deGolpe.trim() ? (leerEuros(deGolpe) ?? 0) : porMonedas;
  const diferencia = contado - r.efectivoEsperado;
  const abiertas = estado.cuentas.filter((c) => c.estado === "abierta" && c.lineas.length);
  const avisos = estado.avisos.filter((a) => !a.atendido && a.tipo !== "listo");
  const pendientes = alertas.filter((a) => !a.clave.startsWith("descuadre-"));

  function cerrarDialogo() {
    setPaso(1);
    setCuenta({});
    setDeGolpe("");
    alCerrar();
  }

  return (
    <Dialogo abierto={abierto} alCerrar={cerrarDialogo} titulo="Cerrar caja" ancho="max-w-2xl">
      <ol className="mb-4 flex gap-1 text-sm" aria-label="Pasos del cierre">
        {["Pendiente", "Contar", "Resumen"].map((t, i) => (
          <li
            key={t}
            aria-current={paso === i + 1 ? "step" : undefined}
            className={clsx(
              "flex-1 rounded-lg px-2 py-1.5 text-center font-semibold",
              paso === i + 1 ? "bg-cobalto text-white" : "bg-zinc-claro text-tinta-suave",
            )}
          >
            {i + 1}. {t}
          </li>
        ))}
      </ol>

      {paso === 1 && (
        <>
          {abiertas.length === 0 && avisos.length === 0 && pendientes.length === 0 ? (
            <p className="mb-4 rounded-xl bg-cuenta-claro p-3 font-semibold">
              Todo en orden: no queda nada pendiente.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {abiertas.length > 0 && (
                <li className="rounded-xl bg-ocupada-claro p-3">
                  <p className="font-semibold">
                    {abiertas.length === 1
                      ? "Queda 1 mesa abierta"
                      : `Quedan ${abiertas.length} mesas abiertas`}
                    : {abiertas.map((c) => buscarMesa(estado, c.mesaId)?.nombre ?? "—").join(", ")}
                  </p>
                  <p className="text-sm">
                    Puedes cerrar igual: seguirán abiertas para el turno siguiente.
                  </p>
                </li>
              )}
              {avisos.length > 0 && (
                <li className="rounded-xl bg-ocupada-claro p-3 font-semibold">
                  {avisos.length === 1
                    ? "Hay 1 aviso sin atender en la sala."
                    : `Hay ${avisos.length} avisos sin atender en la sala.`}
                </li>
              )}
              {pendientes.map((a) => (
                <li key={a.clave} className="rounded-xl bg-zinc-claro p-3">
                  {a.texto}
                </li>
              ))}
            </ul>
          )}
          <Boton variante="primario" tamano="grande" className="w-full" onClick={() => setPaso(2)}>
            Seguir: contar el cajón
          </Boton>
        </>
      )}

      {paso === 2 && (
        <>
          <p className="mb-3">
            Cuenta lo que hay en el cajón. Debería haber <b>{euros(r.efectivoEsperado)}</b>.
          </p>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {VALORES.map((v) => (
              <label key={v} className="flex items-center gap-2 rounded-lg bg-zinc-claro p-2">
                <span className="w-14 text-right text-sm font-semibold">
                  {v >= 100 ? `${v / 100} €` : `${v} cts`}
                </span>
                <span aria-hidden>×</span>
                <input
                  inputMode="numeric"
                  disabled={Boolean(deGolpe.trim())}
                  className="h-9 w-full min-w-0 rounded border border-zinc-oscuro bg-white px-2"
                  value={cuenta[v] ?? ""}
                  onChange={(e) =>
                    setCuenta((c) => ({ ...c, [v]: e.target.value.replace(/\D/g, "") }))
                  }
                  aria-label={`Cuántos de ${v >= 100 ? `${v / 100} euros` : `${v} céntimos`}`}
                />
              </label>
            ))}
          </div>
          <Campo
            etiqueta="O, si ya lo tienes contado, el total"
            ayuda="Si lo escribes aquí, no hace falta rellenar los billetes."
            className="mb-4"
          >
            <input
              className={claseEntrada}
              inputMode="decimal"
              placeholder="Por ejemplo, 412,50"
              value={deGolpe}
              onChange={(e) => setDeGolpe(e.target.value)}
            />
          </Campo>
          <div
            className="mb-4 flex items-baseline justify-between rounded-xl bg-zinc-claro p-3"
            aria-live="polite"
          >
            <span>
              Contado: <b>{euros(contado)}</b>
            </span>
            <TextoDescuadre diferencia={diferencia} />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Boton tamano="grande" onClick={() => setPaso(1)}>
              Atrás
            </Boton>
            <Boton variante="primario" tamano="grande" onClick={() => setPaso(3)}>
              Seguir: ver el resumen
            </Boton>
          </div>
        </>
      )}

      {paso === 3 && (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dato titulo="Ventas" valor={euros(r.ventas)} grande />
            <Dato titulo="Tickets" valor={String(r.tickets)} />
            <Dato
              titulo="Ticket medio"
              valor={r.tickets ? euros(Math.round(r.ventas / r.tickets)) : "—"}
            />
            {(Object.keys(METODOS) as (keyof typeof METODOS)[]).map((m) =>
              r.porMetodo[m] ? (
                <Dato key={m} titulo={METODOS[m]} valor={euros(r.porMetodo[m])} />
              ) : null,
            )}
            {r.propinas > 0 && <Dato titulo="Propinas" valor={euros(r.propinas)} />}
          </dl>
          <ul className="mb-4 space-y-1 text-sm">
            <li>
              Cajón: contado {euros(contado)} · <TextoDescuadre diferencia={diferencia} />
            </li>
            {r.porMetodo.tarjeta > 0 && (
              <li>
                Comprueba que el cierre del datáfono da <b>{euros(r.porMetodo.tarjeta)}</b>.
              </li>
            )}
            <li>
              Anulado: {extras.anulaciones.cantidad} ({euros(extras.anulaciones.importe)}) ·
              Invitado: {extras.invitaciones.cantidad} ({euros(extras.invitaciones.importe)})
            </li>
            {extras.masVendido.length > 0 && (
              <li>
                Lo más vendido:{" "}
                {extras.masVendido.map((p) => `${p.nombre} (${p.unidades})`).join(", ")}
              </li>
            )}
          </ul>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Boton tamano="grande" onClick={() => setPaso(2)}>
              Atrás
            </Boton>
            <Boton
              variante="primario"
              tamano="grande"
              onClick={async () => {
                if (
                  await hacer(
                    { tipo: "cerrar_caja", efectivoContado: contado },
                    "Caja cerrada. Sale el informe Z.",
                  )
                )
                  cerrarDialogo();
              }}
            >
              Cerrar caja y sacar el Z
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}

function TextoDescuadre({ diferencia }: { diferencia: number }) {
  return (
    <span
      className={clsx(
        "font-semibold",
        diferencia < 0 ? "text-aviso" : diferencia > 0 ? "text-tinta" : "text-cuenta",
      )}
    >
      {diferencia === 0
        ? "Cuadra"
        : diferencia < 0
          ? `Faltan ${euros(-diferencia)}`
          : `Sobran ${euros(diferencia)}`}
    </span>
  );
}
