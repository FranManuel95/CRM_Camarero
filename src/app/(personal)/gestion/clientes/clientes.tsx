"use client";

import clsx from "clsx";
import { Download, Search, Trash2, UserPlus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { QrResena } from "@/components/qr-resena";
import { Boton, Campo, claseEntrada, Dialogo, Vacio } from "@/components/ui";
import { descargar } from "@/lib/cliente/descargar";
import { aCsv, importeCsv } from "@/lib/csv";
import { buscarClientes, reglasClub, resumenClub } from "@/lib/dominio/club";
import { euros, leerEuros } from "@/lib/dominio/importes";
import { type ClienteClub, type MetodoGasto, NOMBRE_ALERGENO } from "@/lib/dominio/tipos";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";
import { NuevoCliente } from "../../sala/[mesaId]/cliente";

/** El club de clientes: números, reglas de los puntos, la lista y la ficha de cada uno. */
export function Clientes({ abrirCliente }: { abrirCliente?: string }) {
  const { estado, hacer } = useDatos();
  const fiado = useFuncion("fiado");
  const ahora = useAhora();
  const [busqueda, setBusqueda] = useState("");
  // Desde el buscador de Gestión se llega con la ficha ya abierta.
  const [ficha, setFicha] = useState<ClienteClub | null>(
    () => estado.clientes.find((c) => c.id === abrirCliente) ?? null,
  );
  const [alta, setAlta] = useState(false);
  const origen = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const resumen = resumenClub(estado.clientes, ahora);
  const lista = busqueda.trim()
    ? buscarClientes(estado.clientes, busqueda)
    : [...estado.clientes].sort((a, b) =>
        (b.ultimaVisita ?? b.altaEn).localeCompare(a.ultimaVisita ?? a.altaEn),
      );
  const enlaceAlta = `${origen}/m/${estado.local}/club`;
  const actual = ficha && estado.clientes.find((c) => c.id === ficha.id);

  function exportar() {
    const filas = estado.clientes
      .filter((c) => c.comunicaciones)
      .map((c) => [
        c.nombre,
        c.telefono,
        c.correo,
        c.visitas,
        importeCsv(c.gastado),
        c.ultimaVisita ? formatearFecha(c.ultimaVisita) : "",
      ]);
    descargar(
      `clientes-con-ofertas-${ahora.slice(0, 10)}.csv`,
      aCsv([["Nombre", "Teléfono", "Correo", "Visitas", "Gastado (€)", "Última visita"], ...filas]),
    );
  }

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-rotulo text-4xl font-bold">Clientes</h1>
        <Boton onClick={exportar} disabled={!resumen.conOfertas}>
          <Download aria-hidden className="size-4" /> Los que aceptan ofertas (CSV)
        </Boton>
        <Boton variante="primario" onClick={() => setAlta(true)}>
          <UserPlus aria-hidden className="size-4" /> Apuntar cliente
        </Boton>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ["En el club", String(resumen.total)],
          ["Nuevos (30 días)", String(resumen.nuevos)],
          ["Repiten", String(resumen.repiten)],
          ["Hace +60 días", String(resumen.dormidos)],
          ["Aceptan ofertas", String(resumen.conOfertas)],
          ["Gasto medio", euros(resumen.gastoMedio)],
          ...(fiado
            ? [["Os deben", euros(estado.clientes.reduce((s, c) => s + (c.deuda ?? 0), 0))]]
            : []),
        ].map(([t, v]) => (
          <div key={t} className="rounded-xl bg-white p-3 ring-1 ring-zinc">
            <dt className="text-sm text-tinta-suave">{t}</dt>
            <dd className="font-rotulo text-3xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Reglas />
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-alta">
          <h2 id="t-alta" className="mb-2 font-rotulo text-2xl font-bold">
            Que se apunten solos
          </h2>
          <p className="mb-3 text-sm text-tinta-suave">
            La carta del QR de cada mesa ya invita a apuntarse. Este QR sirve para la barra, la
            puerta o Instagram.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {origen && (
              <QrResena enlace={enlaceAlta} className="w-32" etiqueta="QR para apuntarse al club" />
            )}
            <a href={enlaceAlta} className="min-w-0 flex-1 break-all text-cobalto underline">
              {enlaceAlta}
            </a>
          </div>
        </section>
      </div>

      <label className="relative mb-3 block max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-3 left-3 size-5 text-tinta-suave"
        />
        <input
          type="search"
          className={clsx(claseEntrada, "pl-10")}
          placeholder="Teléfono, nombre o código"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {lista.length === 0 ? (
        <Vacio titulo={busqueda ? "No hay nadie así" : "Aún no hay nadie en el club"}>
          <p>Se apuntan desde el QR de la mesa, o los apuntas tú al cobrar.</p>
        </Vacio>
      ) : (
        <div
          className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc"
          role="region"
          aria-label="Lista de clientes"
          tabIndex={0}
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc text-tinta-suave">
              <tr>
                <th scope="col" className="p-3">
                  Cliente
                </th>
                <th scope="col" className="p-3 text-right">
                  Puntos
                </th>
                <th scope="col" className="p-3 text-right">
                  Visitas
                </th>
                <th scope="col" className="p-3 text-right">
                  Gastado
                </th>
                <th scope="col" className="p-3">
                  Última visita
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc">
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setFicha(c)}
                      className="text-left font-semibold text-cobalto underline"
                    >
                      {c.nombre}
                    </button>
                    <span className="block text-xs text-tinta-suave">
                      {c.telefono}
                      {c.comunicaciones && " · acepta ofertas"}
                      {Boolean(c.deuda) && (
                        <span className="font-semibold text-aviso"> · debe {euros(c.deuda!)}</span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.puntos}</td>
                  <td className="p-3 text-right tabular-nums">{c.visitas}</td>
                  <td className="p-3 text-right tabular-nums">{euros(c.gastado)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {c.ultimaVisita ? formatearFecha(c.ultimaVisita) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={alta} alCerrar={() => setAlta(false)} titulo="Apuntar cliente">
        {alta && (
          <NuevoCliente
            alCancelar={() => setAlta(false)}
            alGuardar={async (datos) => {
              if (
                await hacer(
                  { tipo: "guardar_cliente", ...datos },
                  `${datos.cliente.nombre}, apuntado`,
                )
              )
                setAlta(false);
            }}
          />
        )}
      </Dialogo>

      <Dialogo
        abierto={Boolean(actual)}
        alCerrar={() => setFicha(null)}
        titulo={actual?.nombre ?? ""}
        ancho="max-w-2xl"
      >
        {actual && <Ficha cliente={actual} origen={origen} alCerrar={() => setFicha(null)} />}
      </Dialogo>
    </main>
  );
}

function Ficha({
  cliente,
  origen,
  alCerrar,
}: {
  cliente: ClienteClub;
  origen: string;
  alCerrar: () => void;
}) {
  const { estado, hacer, empleado } = useDatos();
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  if (editando)
    return (
      <NuevoCliente
        inicial={cliente}
        alCancelar={() => setEditando(false)}
        alGuardar={async ({ cliente: datos }) => {
          if (
            await hacer(
              { tipo: "guardar_cliente", cliente: { ...datos, id: cliente.id } },
              "Datos guardados",
            )
          )
            setEditando(false);
        }}
      />
    );
  const tarjeta = `${origen}/m/${estado.local}/club/${cliente.codigo}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-suave">
        {cliente.telefono}
        {cliente.correo && ` · ${cliente.correo}`} · en el club desde{" "}
        {formatearFecha(cliente.altaEn)} (
        {cliente.consentimiento.via === "qr" ? "se apuntó desde el QR" : "lo apuntó el bar"})
        {cliente.comunicaciones ? " · acepta ofertas" : ""}
      </p>
      {cliente.alergenos.length > 0 && (
        <p className="rounded-lg bg-aviso-claro p-2 font-semibold">
          Alergias: {cliente.alergenos.map((a) => NOMBRE_ALERGENO[a].toLowerCase()).join(", ")}
        </p>
      )}
      {cliente.nota && <p>«{cliente.nota}»</p>}
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Puntos", String(cliente.puntos)],
          ["Visitas", String(cliente.visitas)],
          ["Gastado", euros(cliente.gastado)],
        ].map(([t, v]) => (
          <div key={t} className="rounded-xl bg-zinc-claro p-2">
            <dt className="text-xs text-tinta-suave">{t}</dt>
            <dd className="font-rotulo text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {Object.keys(cliente.favoritos).length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Lo que más pide</h3>
          <p className="text-sm">
            {Object.entries(cliente.favoritos)
              .slice(0, 6)
              .map(([p, n]) => `${p} (${n})`)
              .join(" · ")}
          </p>
        </div>
      )}
      {cliente.historial.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Últimas visitas</h3>
          <ul className="max-h-48 divide-y divide-zinc overflow-y-auto text-sm">
            {cliente.historial.map((h) => (
              <li key={h.ticket} className="flex justify-between gap-2 py-1">
                <span>
                  {formatearFechaHora(h.fecha)} · {h.ticket}
                </span>
                <span className="tabular-nums">
                  {euros(h.total)} · +{h.puntos}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Deuda cliente={cliente} />
      <p className="text-sm">
        Su tarjeta (código <strong>{cliente.codigo.slice(0, 6).toUpperCase()}</strong>):{" "}
        <a href={tarjeta} className="break-all text-cobalto underline">
          {tarjeta}
        </a>
      </p>
      <div className="flex flex-wrap justify-between gap-2 border-t border-zinc pt-3">
        {empleado.rol === "encargado" &&
          (borrando ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">¿Borrar sus datos para siempre?</span>
              <Boton
                variante="peligro"
                onClick={async () => {
                  if (
                    await hacer(
                      { tipo: "baja_cliente", clienteId: cliente.id },
                      "Dado de baja y datos borrados",
                    )
                  )
                    alCerrar();
                }}
              >
                Sí, borrar
              </Boton>
              <Boton onClick={() => setBorrando(false)}>No</Boton>
            </span>
          ) : (
            <Boton variante="fantasma" onClick={() => setBorrando(true)}>
              <Trash2 aria-hidden className="size-4" /> Dar de baja
            </Boton>
          ))}
        <span className="ml-auto flex gap-2">
          <Boton onClick={() => setEditando(true)}>Cambiar datos</Boton>
          <Boton variante="primario" onClick={alCerrar}>
            Hecho
          </Boton>
        </span>
      </div>
    </div>
  );
}

/** Lo que debe un cliente (cuentas a deber) y cobrárselo. */
function Deuda({ cliente }: { cliente: ClienteClub }) {
  const { hacer } = useDatos();
  const fiado = useFuncion("fiado");
  const [importe, setImporte] = useState("");
  const [metodo, setMetodo] = useState<MetodoGasto>("efectivo");
  if (!fiado && !cliente.deuda) return null;
  const valor = leerEuros(importe);
  return (
    <div className="rounded-xl bg-ocupada-claro p-3">
      <h3 className="mb-1 font-semibold">
        {cliente.deuda ? `Debe ${euros(cliente.deuda)}` : "No debe nada"}
      </h3>
      {Boolean(cliente.deuda) && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              valor &&
              (await hacer(
                { tipo: "saldar_deuda", clienteId: cliente.id, importe: valor, metodo },
                `Cobrado ${euros(valor)}`,
              ))
            )
              setImporte("");
          }}
        >
          <Campo etiqueta="Paga ahora" className="w-32">
            <input
              className={claseEntrada}
              inputMode="decimal"
              value={importe}
              placeholder={(cliente.deuda! / 100).toFixed(2).replace(".", ",")}
              onChange={(e) => setImporte(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Cómo" className="w-36">
            <select
              className={claseEntrada}
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoGasto)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="bizum">Bizum</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <Boton type="submit" variante="primario" disabled={!valor}>
            Cobrar
          </Boton>
          <Boton onClick={() => setImporte((cliente.deuda! / 100).toFixed(2).replace(".", ","))}>
            Todo
          </Boton>
        </form>
      )}
      {(cliente.apuntesDeuda ?? []).length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto text-sm">
          {cliente.apuntesDeuda!.map((a, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {formatearFechaHora(a.fecha)} · {a.importe > 0 ? `A deber (${a.ticket})` : "Pagó"}
              </span>
              <span className="tabular-nums">{euros(a.importe)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cómo se ganan y se canjean los puntos. */
function Reglas() {
  const { estado, hacer, empleado } = useDatos();
  const reglas = reglasClub(estado);
  const [r, setR] = useState({
    puntosPorEuro: String(reglas.puntosPorEuro),
    puntosPremio: String(reglas.puntosPremio),
    valorPremio: (reglas.valorPremio / 100).toFixed(2).replace(".", ","),
    bienvenida: String(reglas.bienvenida),
  });
  const encargado = empleado.rol === "encargado";
  const valor = leerEuros(r.valorPremio);
  return (
    <form
      className="rounded-2xl bg-white p-4 ring-1 ring-zinc"
      aria-labelledby="t-reglas"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor === null) return;
        void hacer(
          {
            tipo: "reglas_club",
            reglas: {
              puntosPorEuro: Number(r.puntosPorEuro.replace(",", ".")),
              puntosPremio: Number(r.puntosPremio),
              valorPremio: valor,
              bienvenida: Number(r.bienvenida),
            },
          },
          "Puntos del club guardados",
        );
      }}
    >
      <h2 id="t-reglas" className="mb-2 font-rotulo text-2xl font-bold">
        Los puntos
      </h2>
      <fieldset disabled={!encargado} className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Puntos por cada euro">
          <input
            className={claseEntrada}
            inputMode="decimal"
            value={r.puntosPorEuro}
            onChange={(e) => setR({ ...r, puntosPorEuro: e.target.value })}
          />
        </Campo>
        <Campo etiqueta="Puntos de regalo al apuntarse">
          <input
            className={claseEntrada}
            inputMode="numeric"
            value={r.bienvenida}
            onChange={(e) => setR({ ...r, bienvenida: e.target.value })}
          />
        </Campo>
        <Campo etiqueta="Puntos para el premio">
          <input
            className={claseEntrada}
            inputMode="numeric"
            value={r.puntosPremio}
            onChange={(e) => setR({ ...r, puntosPremio: e.target.value })}
          />
        </Campo>
        <Campo etiqueta="El premio vale (€)">
          <input
            className={claseEntrada}
            inputMode="decimal"
            value={r.valorPremio}
            onChange={(e) => setR({ ...r, valorPremio: e.target.value })}
          />
        </Campo>
      </fieldset>
      {encargado && (
        <Boton type="submit" variante="primario" className="mt-3" disabled={valor === null}>
          Guardar
        </Boton>
      )}
    </form>
  );
}
