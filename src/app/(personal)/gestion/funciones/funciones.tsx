"use client";

import { useDatos } from "@/components/datos-personal";
import { Interruptor } from "@/components/ui";
import {
  activa,
  type DefinicionFuncion,
  FUNCIONES,
  type Funcion,
  LISTA_FUNCIONES,
  type Servicio,
} from "@/lib/dominio/funciones";

/** Lo que hay que configurar en el servidor para cada servicio. */
const FALTA: Record<Servicio, string> = {
  ia: "Necesita la clave de Claude (ANTHROPIC_API_KEY) en el servidor.",
  pagos: "Necesita la cuenta de Stripe del bar (STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET).",
  correo: "Necesita un proveedor de correo (RESEND_API_KEY y CORREO_REMITENTE).",
};

/** Encender y apagar funciones del bar. Apagar no borra nada: al encender, todo sigue ahí. */
export function Funciones() {
  const { estado, hacer } = useDatos();
  const grupos = [...new Set(LISTA_FUNCIONES.map((f) => FUNCIONES[f].grupo))];

  return (
    <main>
      <h1 className="mb-1 font-rotulo text-4xl font-bold">Funciones</h1>
      <p className="mb-5 max-w-2xl text-tinta-suave">
        Enciende solo lo que uses. Lo apagado desaparece de las pantallas de todo el equipo; los
        datos se guardan y vuelven al encenderlo.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((grupo) => (
          <section
            key={grupo}
            aria-labelledby={`g-${grupo}`}
            className="rounded-2xl bg-white p-4 ring-1 ring-zinc"
          >
            <h2 id={`g-${grupo}`} className="mb-3 font-rotulo text-2xl font-bold">
              {grupo}
            </h2>
            <ul className="grid gap-4">
              {LISTA_FUNCIONES.filter((f) => FUNCIONES[f].grupo === grupo).map((f: Funcion) => {
                const def: DefinicionFuncion = FUNCIONES[f];
                const falta = def.necesita && !estado.servicios[def.necesita];
                const encendida = activa(estado.ajustes, f);
                return (
                  <li key={f}>
                    <Interruptor
                      activo={encendida && !falta}
                      bloqueado={Boolean(falta)}
                      alCambiar={(v) =>
                        void hacer(
                          { tipo: "cambiar_funcion", funcion: f, activa: v },
                          `${def.nombre}: ${v ? "encendido" : "apagado"}`,
                        )
                      }
                      etiqueta={def.nombre}
                      ayuda={
                        <>
                          {def.descripcion}
                          {falta && def.necesita && (
                            <span className="mt-0.5 block font-semibold text-aviso">
                              {FALTA[def.necesita]}
                            </span>
                          )}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
