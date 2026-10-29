"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useAhora } from "@/lib/cliente/use-ahora";
import { formatearHora } from "@/lib/fechas";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor } from "@/components/ui";
import { LISTA_PERMISOS, NOMBRE_PERMISO, puede } from "@/lib/dominio/permisos";
import type { Permiso, Rol } from "@/lib/dominio/tipos";

type Borrador = {
  id?: string;
  nombre: string;
  pin: string;
  rol: Rol;
  activo: boolean;
  permisos?: Partial<Record<Permiso, boolean>>;
};

export function Equipo({ nube }: { nube: boolean }) {
  const { estado, hacer } = useDatos();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const empleados = [...estado.empleados].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre),
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <Boton
          variante="primario"
          onClick={() => setBorrador({ nombre: "", pin: "", rol: "camarero", activo: true })}
        >
          <Plus aria-hidden className="size-4" /> Añadir persona
        </Boton>
      </div>
      <ul className="divide-y divide-zinc rounded-2xl bg-white ring-1 ring-zinc">
        {empleados.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className="grid size-10 place-items-center rounded-full bg-cobalto-claro font-rotulo text-xl font-bold text-cobalto-oscuro"
              aria-hidden
            >
              {e.nombre[0]}
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{e.nombre}</span>
              <span className="block text-sm text-tinta-suave">
                {e.rol === "encargado"
                  ? "Encargado: puede tocar la carta, los gastos y los ajustes"
                  : `Camarero${(() => {
                      const sin = LISTA_PERMISOS.filter((p) => !puede(estado.ajustes, e, p));
                      return sin.length
                        ? ` · sin ${sin.map((p) => NOMBRE_PERMISO[p].nombre.toLowerCase()).join(", ")}`
                        : "";
                    })()}`}
                {!e.activo && " · desactivado"}
              </span>
            </span>
            <Boton
              tamano="pequeno"
              variante="fantasma"
              aria-label={`Editar a ${e.nombre}`}
              onClick={() => setBorrador({ ...e, pin: "" })}
            >
              <Pencil aria-hidden className="size-4" />
            </Boton>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-tinta-suave">
        Cada persona entra con su PIN: así queda apuntado quién anota, anula o cobra cada cosa. Para
        dar de baja a alguien, desactívalo (su historial se conserva).
      </p>

      {nube && <VincularAparato />}

      <Dialogo
        abierto={borrador !== null}
        alCerrar={() => setBorrador(null)}
        titulo={borrador?.id ? `Editar a ${borrador.nombre}` : "Añadir persona"}
      >
        {borrador && (
          <div className="space-y-4">
            <Campo etiqueta="Nombre">
              <input
                className={claseEntrada}
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              />
            </Campo>
            <Campo
              etiqueta="PIN (4 a 6 cifras)"
              ayuda={borrador.id ? "Déjalo vacío para que siga con el mismo." : undefined}
            >
              <input
                className={claseEntrada}
                inputMode="numeric"
                maxLength={6}
                value={borrador.pin}
                onChange={(e) =>
                  setBorrador({ ...borrador, pin: e.target.value.replace(/\D/g, "") })
                }
              />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Papel</legend>
              <div className="flex gap-2">
                {(["camarero", "encargado"] as const).map((r) => (
                  <Boton
                    key={r}
                    variante={borrador.rol === r ? "primario" : "secundario"}
                    onClick={() => setBorrador({ ...borrador, rol: r })}
                  >
                    {r === "camarero" ? "Camarero" : "Encargado"}
                  </Boton>
                ))}
              </div>
            </fieldset>
            {borrador.rol === "camarero" && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Qué puede hacer</legend>
                <ul className="space-y-2">
                  {LISTA_PERMISOS.map((p) => (
                    <li key={p}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-5 shrink-0"
                          checked={puede(estado.ajustes, borrador, p)}
                          onChange={(e) =>
                            setBorrador({
                              ...borrador,
                              permisos: { ...borrador.permisos, [p]: e.target.checked },
                            })
                          }
                        />
                        <span>
                          <span className="font-semibold">{NOMBRE_PERMISO[p].nombre}</span>
                          <span className="block text-tinta-suave">
                            {NOMBRE_PERMISO[p].detalle}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            <Interruptor
              activo={borrador.activo}
              alCambiar={(v) => setBorrador({ ...borrador, activo: v })}
              etiqueta="Activo"
            />
            <Boton
              variante="primario"
              className="w-full"
              disabled={!borrador.nombre.trim() || (!borrador.id && borrador.pin.length < 4)}
              onClick={async () => {
                if (await hacer({ tipo: "guardar_empleado", empleado: borrador }, "Guardado"))
                  setBorrador(null);
              }}
            >
              Guardar
            </Boton>
          </div>
        )}
      </Dialogo>
    </>
  );
}

/** Código de 6 cifras para vincular el móvil de un camarero a este bar. */
function VincularAparato() {
  const { estado, hacer } = useDatos();
  const ahora = useAhora(15_000);
  const vigente = (estado.vinculos ?? []).filter((v) => v.caduca > ahora).at(-1);
  return (
    <section
      aria-labelledby="t-vincular"
      className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-zinc"
    >
      <h2 id="t-vincular" className="mb-1 font-rotulo text-2xl font-bold">
        Vincular un aparato
      </h2>
      <p className="mb-3 text-sm text-tinta-suave">
        Para usar el móvil de un camarero o una tablet: en ese aparato abre esta web, pulsa «Entrar»
        y escribe el identificador del bar y el código. Después cada uno entra con su PIN.
      </p>
      {vigente ? (
        <div className="mb-3 flex flex-wrap items-center gap-6 rounded-xl bg-zinc-claro p-4">
          <p>
            <span className="block text-sm text-tinta-suave">Identificador del bar</span>
            <span className="font-rotulo text-3xl font-bold">{estado.local}</span>
          </p>
          <p>
            <span className="block text-sm text-tinta-suave">Código</span>
            <span className="font-rotulo text-4xl font-bold tracking-[0.2em]">
              {vigente.codigo}
            </span>
          </p>
          <p className="text-sm text-tinta-suave" suppressHydrationWarning>
            Vale hasta las {formatearHora(vigente.caduca)} y solo una vez.
          </p>
        </div>
      ) : null}
      <Boton
        variante={vigente ? "secundario" : "primario"}
        onClick={() => hacer({ tipo: "crear_codigo_vinculo" })}
      >
        {vigente ? "Otro código" : "Sacar un código"}
      </Boton>
    </section>
  );
}
