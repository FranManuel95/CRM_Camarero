"use client";

import clsx from "clsx";
import { Clock, PackageCheck, ShoppingBag, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo } from "@/components/ui";
import { euros, totalCuenta } from "@/lib/dominio/importes";
import { pedidosParaLlevar, PREFIJO_LLEVAR } from "@/lib/dominio/selectores";
import type { Cuenta } from "@/lib/dominio/tipos";

const EN_COCINA = new Set(["enviada", "lista", "en_espera"]);

/** Cómo va un pedido para llevar, en una palabra. */
function situacion(c: Cuenta): { texto: string; clase: string } {
  const vivas = c.lineas.filter((l) => l.estado !== "anulada");
  if (vivas.some((l) => l.estado === "por_confirmar"))
    return { texto: "Por aceptar", clase: "bg-qr-claro ring-qr" };
  if (!vivas.length || vivas.some((l) => l.estado === "anotada"))
    return { texto: "Sin mandar", clase: "bg-white ring-zinc-oscuro" };
  const cocina = vivas.filter((l) => EN_COCINA.has(l.estado));
  if (cocina.some((l) => l.estado !== "lista"))
    return { texto: "Preparando", clase: "bg-ocupada-claro ring-ocupada" };
  return { texto: "Listo para recoger", clase: "bg-cuenta-claro ring-cuenta" };
}

/** Los encargos que faltan por entregar, por hora de recogida. */
export function ListaParaLlevar() {
  const { estado, hacer } = useDatos();
  const pedidos = pedidosParaLlevar(estado);
  if (!pedidos.length) return null;
  return (
    <section aria-labelledby="titulo-llevar" className="mb-5">
      <h2
        id="titulo-llevar"
        className="mb-2 flex items-center gap-2 font-rotulo text-2xl font-bold"
      >
        <ShoppingBag aria-hidden className="size-5" /> Para llevar
      </h2>
      <ul className="space-y-2">
        {pedidos.map((c) => {
          const s = situacion(c);
          const pagado = c.estado === "cobrada";
          const pendientes = c.lineas.filter((l) => EN_COCINA.has(l.estado));
          return (
            <li key={c.id} className={clsx("rounded-xl p-3 ring-2", s.clase)}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Clock aria-hidden className="size-4 shrink-0" />
                    {c.llevar!.recogida} · {c.llevar!.nombre}
                    {c.llevar!.online && (
                      <Smartphone aria-label="Pedido desde el móvil" className="size-4 shrink-0" />
                    )}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {s.texto} · {pagado ? "Pagado con tarjeta" : euros(totalCuenta(c))}
                    {c.llevar!.telefono && ` · ${c.llevar!.telefono}`}
                  </p>
                </div>
                {pagado ? (
                  <Boton
                    tamano="pequeno"
                    variante="exito"
                    onClick={() =>
                      hacer(
                        {
                          tipo: "marcar_servida",
                          cuentaId: c.id,
                          lineaIds: pendientes.map((l) => l.id),
                        },
                        "Entregado",
                      )
                    }
                  >
                    <PackageCheck aria-hidden className="size-4" /> Entregado
                  </Boton>
                ) : (
                  <Link
                    href={`/sala/${c.mesaId}`}
                    className="rounded-lg bg-cobalto px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Abrir
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Dentro de media hora, redondeado al cuarto (lo normal al coger un encargo por teléfono). */
function horaSugerida() {
  const partes = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + 30 * 60_000));
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const minutos = Math.min(
    23 * 60 + 45,
    Math.ceil((valor("hour") * 60 + valor("minute")) / 15) * 15,
  );
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

/** Apunta un encargo para llevar y abre su cuenta para anotar lo que piden. */
export function NuevoParaLlevar({
  abierto,
  alCerrar,
  alAbrir,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alAbrir: (mesaId: string) => void;
}) {
  const { hacer } = useDatos();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [recogida, setRecogida] = useState(horaSugerida);

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    // El código lo pone el aparato, para poder ir a la cuenta sin esperar a que vuelva.
    const cuentaId = `sr-${crypto.randomUUID()}`;
    if (await hacer({ tipo: "abrir_para_llevar", nombre, telefono, recogida, cuentaId })) {
      alCerrar();
      setNombre("");
      setTelefono("");
      alAbrir(`${PREFIJO_LLEVAR}${cuentaId}`);
    }
  }

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Nuevo para llevar">
      <form onSubmit={apuntar} className="grid gap-3">
        <Campo etiqueta="Nombre" ayuda="Para llamarle cuando venga a recogerlo.">
          <input
            className={claseEntrada}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            required
            autoComplete="off"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Teléfono (opcional)">
            <input
              className={claseEntrada}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              maxLength={20}
              autoComplete="off"
            />
          </Campo>
          <Campo etiqueta="Recoge a las">
            <input
              type="time"
              className={claseEntrada}
              value={recogida}
              onChange={(e) => setRecogida(e.target.value)}
              required
            />
          </Campo>
        </div>
        <Boton type="submit" variante="primario" tamano="grande">
          Apuntar y anotar lo que piden
        </Boton>
      </form>
    </Dialogo>
  );
}
