"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, claseEntrada, Interruptor, Vacio } from "@/components/ui";
import type { LocalResumen } from "@/lib/servidor/nube";

async function enviar(url: string, cuerpo: unknown, metodo = "POST") {
  const r = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  const datos = (await r?.json().catch(() => null)) as {
    error?: string;
    id?: string;
    cuentaNueva?: boolean;
  } | null;
  return r?.ok
    ? { ok: true as const, ...datos }
    : { ok: false as const, error: datos?.error ?? "No hay conexión." };
}

/** Una contraseña provisional fácil de dictar: sin letras que se confundan. */
function claveProvisional() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const azar = crypto.getRandomValues(new Uint32Array(10));
  return `Comanda-${Array.from(azar, (n) => letras[n % letras.length]).join("")}`;
}

type Hecho = { nombre: string; id: string; correo: string; clave?: string; pin: string };

export function MisBares({
  bares,
  vinculado,
  correo: miCorreo,
  admin,
}: {
  bares: LocalResumen[];
  vinculado: string | null;
  /** El correo de la cuenta con la que se ha entrado. */
  correo: string;
  /** Quien vende Comanda: da de alta bares para la cuenta de cada dueño. */
  admin: boolean;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(admin && bares.length === 0);
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState(claveProvisional);
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [nombre, setNombre] = useState("");
  const [encargado, setEncargado] = useState("");
  const [pin, setPin] = useState("");
  const [conCarta, setConCarta] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function usarAqui(local: string) {
    setOcupado(true);
    const r = await enviar("/api/aparato", { modo: "dueno", local });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    router.push("/entrar");
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    const para = correo.trim() || miCorreo;
    const r = await enviar("/api/locales", {
      correo: para,
      clave,
      nombre,
      encargado,
      pin,
      conCartaDeEjemplo: conCarta,
    });
    if (!r.ok) {
      setOcupado(false);
      return setError(r.error);
    }
    // Para mí: se abre en este aparato. Para un cliente: los datos para dárselos.
    if (para.toLowerCase() === miCorreo.toLowerCase()) return usarAqui(r.id!);
    setOcupado(false);
    setCreando(false);
    setHecho({ nombre, id: r.id!, correo: para, clave: r.cuentaNueva ? clave : undefined, pin });
    setNombre("");
    setEncargado("");
    setPin("");
    setCorreo("");
    setClave(claveProvisional());
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {bares.length === 0 && !creando && (
        <Vacio titulo="Aún no tienes ningún bar">
          Te lo damos de alta nosotros, ya montado. Pídeselo a quien te ha hablado de Comanda.
        </Vacio>
      )}
      {hecho && (
        <div
          role="status"
          className="space-y-2 rounded-2xl bg-cuenta-claro p-4 ring-1 ring-cuenta/40"
        >
          <p className="font-semibold">
            Hecho: «{hecho.nombre}» ({hecho.id}) para {hecho.correo}.
          </p>
          {hecho.clave ? (
            <p className="text-sm">
              Cuenta nueva con la contraseña provisional <b className="font-mono">{hecho.clave}</b>.
              Apúntala: no se vuelve a enseñar. El dueño pone la suya con «He olvidado la
              contraseña».
            </p>
          ) : (
            <p className="text-sm">Ya tenía cuenta: el bar se ha añadido a sus bares.</p>
          )}
          <p className="text-sm">
            PIN del encargado: <b className="font-mono">{hecho.pin}</b>. Para prepararlo, entra con
            su cuenta y «Usar en este aparato».
          </p>
        </div>
      )}
      {bares.length > 1 && (
        <p className="rounded-xl bg-zinc-claro p-3 text-sm">
          Comanda lleva la facturación de tus {bares.length} bares por separado: cada uno con sus
          tickets, su numeración y su envío a Hacienda, como si fueran programas distintos.
        </p>
      )}
      {bares.length > 0 && (
        <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
          {bares.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-rotulo text-2xl font-bold">{b.nombre}</p>
                <p className="text-sm text-tinta-suave">
                  Identificador: <b>{b.id}</b>
                  {vinculado === b.id && " · este aparato ya está vinculado"}
                </p>
              </div>
              <Boton variante="primario" disabled={ocupado} onClick={() => usarAqui(b.id)}>
                {vinculado === b.id ? "Abrir" : "Usar en este aparato"}
              </Boton>
            </li>
          ))}
        </ul>
      )}

      {creando ? (
        <form onSubmit={crear} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc">
          <h2 className="font-rotulo text-2xl font-bold">Bar nuevo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Correo del dueño" ayuda="Vacío: el bar es para tu cuenta.">
              <input
                className={claseEntrada}
                type="email"
                autoComplete="off"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder={miCorreo}
              />
            </Campo>
            <Campo
              etiqueta="Contraseña provisional"
              ayuda="Solo si su cuenta es nueva. Él pone la suya después."
            >
              <input
                className={clsx(claseEntrada, "font-mono")}
                required
                minLength={8}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </Campo>
          </div>
          <Campo etiqueta="Nombre del bar">
            <input
              className={claseEntrada}
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Bar Paco"
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre del encargado" ayuda="El primero del equipo.">
              <input
                className={claseEntrada}
                required
                value={encargado}
                onChange={(e) => setEncargado(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Su PIN (4 a 6 cifras)" ayuda="Con él entra en la caja y en Gestión.">
              <input
                className={claseEntrada}
                inputMode="numeric"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Campo>
          </div>
          <Interruptor
            activo={conCarta}
            alCambiar={setConCarta}
            etiqueta="Empezar con una carta de ejemplo"
            ayuda="Cañas, tapas, raciones… para cambiar precios y nombres en vez de empezar de cero."
          />
          <p role="alert" className="min-h-5 text-sm font-semibold text-aviso">
            {error}
          </p>
          <div className="flex justify-end gap-2">
            {bares.length > 0 && (
              <Boton onClick={() => setCreando(false)} disabled={ocupado}>
                Cancelar
              </Boton>
            )}
            <Boton
              type="submit"
              variante="primario"
              disabled={ocupado || pin.length < 4 || !nombre.trim() || !encargado.trim()}
            >
              Crear el bar
            </Boton>
          </div>
        </form>
      ) : (
        admin && (
          <Boton
            onClick={() => {
              setHecho(null);
              setCreando(true);
            }}
          >
            Dar de alta un bar
          </Boton>
        )
      )}
      {error && !creando && (
        <p role="alert" className="text-sm font-semibold text-aviso">
          {error}
        </p>
      )}

      <Boton
        variante="fantasma"
        onClick={async () => {
          await enviar("/api/dueno", { accion: "salir" });
          router.push("/");
          router.refresh();
        }}
      >
        Salir de mi cuenta
      </Boton>
    </div>
  );
}
