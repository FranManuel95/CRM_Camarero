"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton } from "@/components/ui";

/** Descargar una copia completa y, en el ordenador del bar, volver a una copia. */
export function CopiaSeguridad({ nube }: { nube: boolean }) {
  const { avisar } = useDatos();
  const encendida = useFuncion("copias");
  const archivo = useRef<HTMLInputElement>(null);
  const [restaurando, setRestaurando] = useState(false);
  if (!encendida) return null;

  async function restaurar(f: File) {
    if (
      !confirm(
        `¿Volver a la copia «${f.name}»? Todo lo que haya ahora se sustituye por lo de la copia.`,
      )
    )
      return;
    setRestaurando(true);
    const r = await fetch("/api/copia", { method: "POST", body: await f.text() }).catch(() => null);
    const datos = (await r?.json().catch(() => null)) as { error?: string } | null;
    setRestaurando(false);
    if (!r?.ok) return avisar(datos?.error ?? "No se ha podido restaurar la copia.", "error");
    // Recarga completa: todas las pantallas tienen que empezar de cero con los datos de la copia.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/gestion");
  }

  return (
    <section
      aria-labelledby="t-copia"
      className="mt-6 max-w-2xl space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc"
    >
      <h2 id="t-copia" className="font-rotulo text-2xl font-bold">
        Copia de seguridad
      </h2>
      <p className="text-sm text-tinta-suave">
        Un archivo con todo el bar: carta, mesas, equipo, tickets, gastos, stock y fichajes.
        Guárdalo en un sitio seguro: lleva datos del equipo.
        {!nube && " Además, este ordenador guarda solo una copia al día (las últimas 14)."}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/copia"
          download
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-cobalto px-4 font-semibold text-white hover:bg-cobalto-oscuro"
        >
          <Download aria-hidden className="size-4" /> Descargar copia
        </a>
        {!nube && (
          <>
            <input
              ref={archivo}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void restaurar(f);
              }}
            />
            <Boton disabled={restaurando} onClick={() => archivo.current?.click()}>
              <Upload aria-hidden className="size-4" />
              {restaurando ? "Restaurando…" : "Volver a una copia"}
            </Boton>
          </>
        )}
      </div>
      {nube && (
        <p className="text-xs text-tinta-suave">
          En la nube los tickets son definitivos, así que no se puede volver a una copia: sirve para
          guardarla o para llevarte los datos.
        </p>
      )}
    </section>
  );
}
