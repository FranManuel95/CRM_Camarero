"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor } from "@/components/ui";
import type { Rol } from "@/lib/dominio/tipos";

type Borrador = { id?: string; nombre: string; pin: string; rol: Rol; activo: boolean };

export function Equipo() {
  const { estado, hacer } = useDatos();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const empleados = [...estado.empleados].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre),
  );

  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-rotulo text-4xl font-bold">Equipo</h1>
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
                  : "Camarero"}
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
              <legend className="mb-1 text-sm font-semibold">Permisos</legend>
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
    </main>
  );
}
