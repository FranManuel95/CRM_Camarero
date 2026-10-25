"use client";

import { useState, useSyncExternalStore } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Interruptor } from "@/components/ui";

export function Ajustes() {
  const { estado, hacer, avisar } = useDatos();
  const [a, setA] = useState(estado.ajustes);
  const resenas = useFuncion("resenas");
  const campo = (clave: keyof typeof a, etiqueta: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <input
        className={claseEntrada}
        value={String(a[clave])}
        onChange={(e) => setA({ ...a, [clave]: e.target.value })}
      />
    </Campo>
  );

  return (
    <main className="max-w-2xl">
      <h1 className="mb-4 font-rotulo text-4xl font-bold">Ajustes</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void hacer(
            {
              tipo: "guardar_ajustes",
              ajustes: {
                ...a,
                ivaPorDefecto: Number(a.ivaPorDefecto),
                enlaceResena: a.enlaceResena?.trim() ?? "",
              },
            },
            "Ajustes guardados",
          );
        }}
        className="space-y-6"
      >
        <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc">
          <h2 className="font-rotulo text-2xl font-bold">Datos del ticket</h2>
          <p className="text-sm text-tinta-suave">
            Una factura simplificada tiene que llevar el nombre o razón social, el NIF y la
            dirección.
          </p>
          {campo("nombreLocal", "Nombre del local")}
          {campo("razonSocial", "Razón social o nombre del titular")}
          {campo("nif", "NIF")}
          {campo("direccion", "Dirección")}
          {campo("telefono", "Teléfono")}
          {campo("pieTicket", "Mensaje al pie del ticket")}
          <div className="grid grid-cols-2 gap-3">
            {campo("serieTicket", "Serie de los tickets", "Se le añade el año: T2026-000001.")}
            <Campo etiqueta="IVA por defecto">
              <select
                className={claseEntrada}
                value={a.ivaPorDefecto}
                onChange={(e) => setA({ ...a, ivaPorDefecto: Number(e.target.value) })}
              >
                {[10, 21, 4, 0].map((i) => (
                  <option key={i} value={i}>
                    {i} %
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </section>
        <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-zinc">
          <h2 className="font-rotulo text-2xl font-bold">Carta QR</h2>
          <Interruptor
            activo={a.pedidosQRActivos}
            alCambiar={(v) => setA({ ...a, pedidosQRActivos: v })}
            etiqueta="Los clientes pueden pedir desde el QR"
            ayuda="Si lo quitas, el QR sirve solo para ver la carta, llamar al camarero y pedir la cuenta."
          />
          <Interruptor
            activo={a.confirmarPedidosQR}
            alCambiar={(v) => setA({ ...a, confirmarPedidosQR: v })}
            etiqueta="Un camarero acepta cada pedido antes de mandarlo"
            ayuda="Recomendado: evita pedidos de broma. Si lo quitas, va directo a cocina y barra."
          />
        </section>
        {resenas && (
          <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc">
            <h2 className="font-rotulo text-2xl font-bold">Reseñas</h2>
            <Campo
              etiqueta="Enlace para dejar una reseña"
              ayuda="El de tu ficha de Google, TripAdvisor… Sale en la carta al pagar y con un QR al pie del ticket."
            >
              <input
                type="url"
                className={claseEntrada}
                value={a.enlaceResena ?? ""}
                placeholder="https://"
                onChange={(e) => setA({ ...a, enlaceResena: e.target.value })}
              />
            </Campo>
          </section>
        )}
        <Boton type="submit" variante="primario" tamano="grande">
          Guardar ajustes
        </Boton>
      </form>

      <EnlacesClientes />

      {process.env.NEXT_PUBLIC_DEMO !== "false" && (
        <section className="mt-8 rounded-2xl bg-aviso-claro p-4">
          <h2 className="mb-1 font-rotulo text-2xl font-bold">Demostración</h2>
          <p className="mb-3 text-sm">
            Vuelve a los datos de ejemplo de La Esquina. Se borra todo lo que hayas hecho.
          </p>
          <Boton
            variante="peligro"
            onClick={async () => {
              if (!confirm("¿Volver a los datos de ejemplo? Se pierde todo lo demás.")) return;
              const r = await fetch("/api/demo", { method: "POST" });
              // Recarga completa a propósito: la sesión ha cambiado y hay que empezar de cero.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              if (r.ok) window.location.assign("/sala");
              else
                avisar(
                  ((await r.json().catch(() => null)) as { error?: string } | null)?.error ??
                    "No se ha podido reiniciar.",
                  "error",
                );
            }}
          >
            Volver a los datos de ejemplo
          </Boton>
        </section>
      )}
    </main>
  );
}

/** Los enlaces que el bar pone en su web o en redes para reservar o encargar. */
function EnlacesClientes() {
  const { estado, avisar } = useDatos();
  const reservasOnline = useFuncion("reservasOnline");
  const reservas = useFuncion("reservas");
  const pedidosOnline = useFuncion("pedidosOnline");
  const paraLlevar = useFuncion("paraLlevar");
  const reservar = reservasOnline && reservas;
  const encargar = pedidosOnline && paraLlevar;
  // La dirección del servidor solo se sabe en el navegador.
  const origen = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const enlaces = [
    reservar && { titulo: "Reservar mesa", url: `${origen}/m/${estado.local}/reservar` },
    encargar && { titulo: "Encargar para llevar", url: `${origen}/m/${estado.local}/llevar` },
  ].filter((e): e is { titulo: string; url: string } => Boolean(e));
  if (!enlaces.length) return null;
  return (
    <section className="mt-6 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc">
      <h2 className="font-rotulo text-2xl font-bold">Enlaces para tus clientes</h2>
      <p className="text-sm text-tinta-suave">
        Ponlos en tu web, en Google o en Instagram. Se apagan desde Gestión → Funciones.
      </p>
      <ul className="space-y-2">
        {enlaces.map((e) => (
          <li key={e.url} className="flex flex-wrap items-center gap-2">
            <span className="w-full font-semibold sm:w-44">{e.titulo}</span>
            <a href={e.url} className="min-w-0 flex-1 truncate text-cobalto underline">
              {e.url}
            </a>
            <Boton
              tamano="pequeno"
              onClick={() =>
                navigator.clipboard
                  .writeText(e.url)
                  .then(() => avisar("Enlace copiado"))
                  .catch(() => avisar("No se ha podido copiar", "error"))
              }
            >
              Copiar
            </Boton>
          </li>
        ))}
      </ul>
    </section>
  );
}
