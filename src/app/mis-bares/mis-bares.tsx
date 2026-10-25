"use client";

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
  const datos = (await r?.json().catch(() => null)) as { error?: string; id?: string } | null;
  return r?.ok
    ? { ok: true as const, ...datos }
    : { ok: false as const, error: datos?.error ?? "No hay conexión." };
}

export function MisBares({
  bares,
  vinculado,
}: {
  bares: LocalResumen[];
  vinculado: string | null;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(bares.length === 0);
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
    const r = await enviar("/api/locales", { nombre, encargado, pin, conCartaDeEjemplo: conCarta });
    if (!r.ok) {
      setOcupado(false);
      return setError(r.error);
    }
    // El bar recién creado se abre en este aparato, listo para entrar con el PIN.
    await usarAqui(r.id!);
  }

  return (
    <div className="space-y-6">
      {bares.length === 0 && !creando && <Vacio titulo="Aún no tienes ningún bar" />}
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
            <Campo etiqueta="Tu nombre" ayuda="Serás el primer encargado.">
              <input
                className={claseEntrada}
                required
                value={encargado}
                onChange={(e) => setEncargado(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Tu PIN (4 a 6 cifras)" ayuda="Con él entras en la caja y en Gestión.">
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
        <Boton onClick={() => setCreando(true)}>Dar de alta otro bar</Boton>
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
