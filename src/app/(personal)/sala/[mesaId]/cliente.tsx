"use client";

import clsx from "clsx";
import { AlertTriangle, Gift, Search, Star, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { buscarClientes, puedeCanjear, reglasClub } from "@/lib/dominio/club";
import { euros } from "@/lib/dominio/importes";
import { ALERGENOS, type Alergeno, type Cuenta, NOMBRE_ALERGENO } from "@/lib/dominio/tipos";

/**
 * El cliente del club de una cuenta: un botón en la cabecera de la mesa. Con un cliente, se ve
 * su nombre, sus puntos y sus alergias; tocando, se busca, se apunta a alguien nuevo o se
 * canjea el premio.
 */
export function ClienteDeCuenta({ cuenta }: { cuenta: Cuenta }) {
  const { estado } = useDatos();
  const club = useFuncion("club");
  const [abierto, setAbierto] = useState(false);
  if (!club) return null;
  const cliente = estado.clientes.find((c) => c.id === cuenta.clienteId);
  return (
    <>
      <Boton
        tamano="pequeno"
        variante={cliente ? "secundario" : "fantasma"}
        onClick={() => setAbierto(true)}
        className={clsx(cliente && "bg-ocupada-claro ring-ocupada")}
      >
        <Star aria-hidden className={clsx("size-4", cliente && "fill-current text-ocupada")} />
        {cliente ? `${cliente.nombre.split(" ")[0]} · ${cliente.puntos} pts` : "Cliente del club"}
        {cliente && cliente.alergenos.length > 0 && (
          <AlertTriangle aria-label="Tiene alergias" className="size-4 text-aviso" />
        )}
      </Boton>
      <Dialogo
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo={cliente ? cliente.nombre : "Cliente del club"}
      >
        {abierto && <Contenido cuenta={cuenta} alCerrar={() => setAbierto(false)} />}
      </Dialogo>
    </>
  );
}

function Contenido({ cuenta, alCerrar }: { cuenta: Cuenta; alCerrar: () => void }) {
  const { estado, hacer } = useDatos();
  const reglas = reglasClub(estado);
  const cliente = estado.clientes.find((c) => c.id === cuenta.clienteId);
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState(false);

  if (cliente) {
    const favoritos = Object.entries(cliente.favoritos).slice(0, 3);
    return (
      <div className="space-y-4">
        {cliente.alergenos.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-aviso-claro p-3 font-semibold">
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-aviso" />
            Alergias: {cliente.alergenos.map((a) => NOMBRE_ALERGENO[a].toLowerCase()).join(", ")}
          </p>
        )}
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
        {favoritos.length > 0 && (
          <p className="text-sm">
            <span className="font-semibold">Suele pedir:</span>{" "}
            {favoritos.map(([p]) => p).join(", ")}
          </p>
        )}
        {cliente.nota && <p className="text-sm">«{cliente.nota}»</p>}
        {Boolean(cliente.deuda) && (
          <p className="rounded-lg bg-ocupada-claro p-2 font-semibold">
            Debe {euros(cliente.deuda!)} de otras veces.
          </p>
        )}
        {cuenta.canje ? (
          <Boton
            className="w-full"
            onClick={() =>
              hacer(
                { tipo: "canjear_puntos", cuentaId: cuenta.id, canjear: false },
                "Premio quitado",
              )
            }
          >
            <X aria-hidden className="size-4" /> Quitar el premio ({euros(cuenta.canje.importe)})
          </Boton>
        ) : puedeCanjear(cliente, cuenta, reglas) ? (
          <Boton
            variante="exito"
            tamano="grande"
            className="w-full"
            onClick={() =>
              hacer(
                { tipo: "canjear_puntos", cuentaId: cuenta.id, canjear: true },
                `Premio aplicado: −${euros(reglas.valorPremio)}`,
              )
            }
          >
            <Gift aria-hidden className="size-5" /> Canjear {reglas.puntosPremio} puntos por{" "}
            {euros(reglas.valorPremio)}
          </Boton>
        ) : (
          <p className="text-sm text-tinta-suave">
            {cliente.puntos >= reglas.puntosPremio
              ? `Tiene el premio, pero la cuenta tiene que ser de al menos ${euros(reglas.valorPremio)}.`
              : `Le faltan ${reglas.puntosPremio - cliente.puntos} puntos para ${euros(reglas.valorPremio)} de descuento.`}
          </p>
        )}
        <div className="flex justify-between gap-2">
          <Boton
            variante="fantasma"
            onClick={() =>
              hacer(
                { tipo: "asignar_cliente", cuentaId: cuenta.id, clienteId: null },
                "Quitado de la cuenta",
              )
            }
          >
            Quitar de esta cuenta
          </Boton>
          <Boton variante="primario" onClick={alCerrar}>
            Hecho
          </Boton>
        </div>
      </div>
    );
  }

  if (nuevo)
    return (
      <NuevoCliente
        alCancelar={() => setNuevo(false)}
        alGuardar={async (datos) => {
          if (
            await hacer(
              { tipo: "guardar_cliente", ...datos, asignarA: cuenta.id },
              `${datos.cliente.nombre}, apuntado al club`,
            )
          )
            alCerrar();
        }}
      />
    );

  const resultados = buscarClientes(estado.clientes, busqueda);
  return (
    <div>
      <label className="relative mb-3 block">
        <span className="sr-only">Buscar por teléfono, nombre o código</span>
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
          autoComplete="off"
        />
      </label>
      {busqueda.trim() && !resultados.length && (
        <p className="mb-3 text-sm text-tinta-suave">No está en el club.</p>
      )}
      <ul className="mb-3 divide-y divide-zinc">
        {resultados.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.nombre}</p>
              <p className="text-sm text-tinta-suave">
                {c.telefono} · {c.puntos} puntos
                {c.alergenos.length > 0 && " · tiene alergias"}
              </p>
            </div>
            <Boton
              tamano="pequeno"
              variante="primario"
              onClick={async () => {
                if (
                  await hacer(
                    { tipo: "asignar_cliente", cuentaId: cuenta.id, clienteId: c.id },
                    `Suma puntos para ${c.nombre}`,
                  )
                )
                  alCerrar();
              }}
            >
              Es este
            </Boton>
          </li>
        ))}
      </ul>
      <Boton className="w-full" onClick={() => setNuevo(true)}>
        <UserPlus aria-hidden className="size-4" /> Apuntar a alguien nuevo
      </Boton>
    </div>
  );
}

type DatosNuevo = {
  cliente: {
    nombre: string;
    telefono: string;
    correo: string;
    alergenos: Alergeno[];
    comunicaciones: boolean;
    nota: string;
  };
  consentimiento: boolean;
};

/** Alta de un cliente en la caja o en la mesa (con su consentimiento, de palabra). */
export function NuevoCliente({
  alCancelar,
  alGuardar,
  inicial,
}: {
  alCancelar: () => void;
  alGuardar: (datos: DatosNuevo) => Promise<void>;
  inicial?: DatosNuevo["cliente"];
}) {
  const [c, setC] = useState<DatosNuevo["cliente"]>(
    inicial ?? {
      nombre: "",
      telefono: "",
      correo: "",
      alergenos: [],
      comunicaciones: false,
      nota: "",
    },
  );
  const [acepta, setAcepta] = useState(Boolean(inicial));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void alGuardar({ cliente: c, consentimiento: acepta });
      }}
      className="grid gap-3"
    >
      <Campo etiqueta="Nombre">
        <input
          className={claseEntrada}
          value={c.nombre}
          onChange={(e) => setC({ ...c, nombre: e.target.value })}
          maxLength={60}
          required
          autoComplete="off"
        />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Teléfono">
          <input
            className={claseEntrada}
            value={c.telefono}
            onChange={(e) => setC({ ...c, telefono: e.target.value })}
            inputMode="tel"
            maxLength={16}
            required
            autoComplete="off"
          />
        </Campo>
        <Campo etiqueta="Correo (opcional)">
          <input
            type="email"
            className={claseEntrada}
            value={c.correo}
            onChange={(e) => setC({ ...c, correo: e.target.value })}
            maxLength={120}
            autoComplete="off"
          />
        </Campo>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Alergias (opcional)</legend>
        <div className="flex flex-wrap gap-1.5">
          {ALERGENOS.map((a) => {
            const activa = c.alergenos.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={activa}
                onClick={() =>
                  setC({
                    ...c,
                    alergenos: activa ? c.alergenos.filter((x) => x !== a) : [...c.alergenos, a],
                  })
                }
                className={clsx(
                  "h-8 rounded-full px-2.5 text-sm ring-1",
                  activa ? "bg-aviso text-white ring-aviso" : "ring-zinc-oscuro",
                )}
              >
                {NOMBRE_ALERGENO[a]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Campo etiqueta="Nota (opcional)">
        <input
          className={claseEntrada}
          value={c.nota}
          onChange={(e) => setC({ ...c, nota: e.target.value })}
          maxLength={200}
          placeholder="Le gusta la terraza, celíaco…"
        />
      </Campo>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={c.comunicaciones}
          onChange={(e) => setC({ ...c, comunicaciones: e.target.checked })}
        />
        <span className="text-sm">Quiere recibir ofertas y novedades.</span>
      </label>
      {!inicial && (
        <label className="flex items-start gap-3 rounded-lg bg-cobalto-claro p-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            required
          />
          <span className="text-sm">
            El cliente acepta que guardemos su nombre, su teléfono y lo que consume para el club de
            puntos, y sabe que puede pedir que lo borremos.
          </span>
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Boton onClick={alCancelar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" disabled={!acepta}>
          {inicial ? "Guardar" : "Apuntar"}
        </Boton>
      </div>
    </form>
  );
}
