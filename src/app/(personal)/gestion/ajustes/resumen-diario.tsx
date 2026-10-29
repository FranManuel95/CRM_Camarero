"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Interruptor } from "@/components/ui";
import { useAhora } from "@/lib/cliente/use-ahora";
import { sumarDias } from "@/lib/dominio/informes";
import { fechaLarga, resumenDelDia } from "@/lib/dominio/resumen-diario";
import { diaLocal } from "@/lib/fechas";

/** Cada mañana, el resumen del día anterior en el correo del dueño (aunque no vaya al bar). */
export function ResumenDiario() {
  const { estado, hacer, avisar } = useDatos();
  const ahora = useAhora(60_000);
  const actual = estado.ajustes.resumenDiario;
  const [correo, setCorreo] = useState(actual?.correo ?? "");
  const [mandando, setMandando] = useState(false);
  const conCorreo = estado.servicios.correo;
  const ayer = sumarDias(diaLocal(ahora), -1);
  const vista = resumenDelDia(estado, ayer);

  const guardar = (activo: boolean) =>
    hacer(
      { tipo: "guardar_resumen_diario", correo: correo.trim(), activo },
      activo ? "Te lo mandamos cada mañana" : "Resumen diario apagado",
    );

  async function mandarAhora() {
    setMandando(true);
    try {
      const r = await fetch("/api/resumen-diario", { method: "POST" });
      const datos = (await r.json()) as { error?: string };
      if (datos.error) avisar(datos.error, "error");
      else avisar("Resumen de ayer mandado");
    } finally {
      setMandando(false);
    }
  }

  return (
    <section
      aria-labelledby="t-resumen"
      className="mt-6 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc"
    >
      <h2 id="t-resumen" className="font-rotulo text-2xl font-bold">
        Resumen diario por correo
      </h2>
      <p className="text-sm text-tinta-suave">
        Cada mañana, sobre las 8, lo del día anterior: ventas, cierre de caja, anulaciones, lo más
        vendido, gastos y las reservas del día.
      </p>
      {!conCorreo && (
        <p className="rounded-lg bg-ocupada-claro p-3 text-sm">
          Para mandarlo hace falta configurar el servicio de correo en el servidor. Mientras, puedes
          ver aquí abajo cómo queda.
        </p>
      )}
      <Campo etiqueta="Correo del dueño">
        <input
          type="email"
          className={claseEntrada}
          value={correo}
          placeholder="dueno@ejemplo.es"
          onChange={(e) => setCorreo(e.target.value)}
          onBlur={() =>
            correo.trim() !== (actual?.correo ?? "") && guardar(Boolean(actual?.activo))
          }
        />
      </Campo>
      <Interruptor
        activo={Boolean(actual?.activo)}
        alCambiar={(v) => guardar(v)}
        etiqueta="Mandarlo cada mañana"
        bloqueado={!correo.trim()}
      />
      {conCorreo && actual?.correo && (
        <Boton tamano="pequeno" disabled={mandando} onClick={mandarAhora}>
          <Mail aria-hidden className="size-4" /> Mandarme el de ayer ahora
        </Boton>
      )}
      <details className="rounded-lg bg-zinc-claro p-3">
        <summary className="cursor-pointer font-semibold">
          Así sería el de ayer ({fechaLarga(ayer)})
        </summary>
        <p className="mt-2 font-semibold">{vista.asunto}</p>
        {vista.apartados.map((a) => (
          <div key={a.titulo} className="mt-2 text-sm">
            <p className="font-semibold">{a.titulo}</p>
            <ul className="list-disc pl-5">
              {a.lineas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}
