"use client";

import clsx from "clsx";
import {
  Zap,
  BellRing,
  CalendarDays,
  CheckCheck,
  Clock,
  Hand,
  List,
  Map as IconoPlano,
  QrCode,
  Receipt,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDatos, useFuncion } from "@/components/datos-personal";
import { DecoracionesPlano } from "@/components/decoracion-plano";
import { Comanda } from "./[mesaId]/comanda";
import { Boton, Dialogo } from "@/components/ui";
import { euros } from "@/lib/dominio/importes";
import { reservaCercana } from "@/lib/dominio/reservas";
import {
  buscarMesa,
  MESA_VENTA_RAPIDA,
  situacionMesa,
  type SituacionMesa,
  TEXTO_SITUACION,
} from "@/lib/dominio/selectores";
import type { Aviso, Mesa } from "@/lib/dominio/tipos";
import { formatearHora, minutosEntre } from "@/lib/fechas";
import { useAhora } from "@/lib/cliente/use-ahora";
import { useGuardado } from "@/lib/cliente/use-guardado";
import { ListaParaLlevar, NuevoParaLlevar } from "./para-llevar";

export const COLOR_SITUACION: Record<SituacionMesa, string> = {
  libre: "bg-white ring-zinc-oscuro text-tinta",
  ocupada: "bg-ocupada-claro ring-ocupada text-tinta",
  qr: "bg-qr-claro ring-qr text-tinta",
  cuenta: "bg-cuenta-claro ring-cuenta text-tinta",
  aviso: "bg-aviso-claro ring-aviso text-tinta",
};

/** Botones de la sala (venta rápida, para llevar, reservas). */
const claseAtajo =
  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold sm:h-11 sm:flex-row sm:gap-1.5 sm:px-4 sm:text-base";

const ICONO_AVISO = {
  llamar: Hand,
  cuenta: Receipt,
  pedido_qr: QrCode,
  listo: UtensilsCrossed,
} as const;
const TEXTO_AVISO = {
  llamar: "Te llaman",
  cuenta: "Pide la cuenta",
  pedido_qr: "Pedido desde el QR",
  listo: "Listo para servir",
} as const;

export function Sala() {
  const { estado, hacer } = useDatos();
  const ventaRapida = useFuncion("ventaRapida");
  const paraLlevar = useFuncion("paraLlevar");
  const reservas = useFuncion("reservas");
  const [nuevoLlevar, setNuevoLlevar] = useState(false);
  const router = useRouter();
  const ahora = useAhora();
  const zonas = [...estado.zonas].sort((a, b) => a.orden - b.orden);
  const [zonaId, setZonaId] = useState(zonas[0]?.id ?? "");
  const [vista, cambiarVista] = useGuardado<"plano" | "lista">("comanda.vistaSala", "plano");
  const [abrir, setAbrir] = useState<Mesa | null>(null);

  const mesas = estado.mesas.filter((m) => m.zonaId === zonaId);
  const avisos = estado.avisos
    .filter((a) => !a.atendido)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const ocupadas = estado.cuentas.filter(
    (c) => c.estado === "abierta" && !c.llevar && c.mesaId !== MESA_VENTA_RAPIDA,
  ).length;
  const porConfirmar = reservas
    ? estado.reservas.filter((r) => r.estado === "por_confirmar").length
    : 0;
  const reservaAbrir =
    abrir && reservas ? reservaCercana(estado.reservas, abrir.id, ahora) : undefined;

  // Sin red no se puede ir a otra pantalla: la mesa se abre aquí mismo.
  const [mesaAqui, setMesaAqui] = useState<string | null>(null);
  const irAMesa = (id: string) => (navigator.onLine ? router.push(`/sala/${id}`) : setMesaAqui(id));

  function tocarMesa(mesa: Mesa) {
    if (situacionMesa(estado, mesa).cuenta) irAMesa(mesa.id);
    else setAbrir(mesa);
  }

  async function abrirMesa(comensales: number) {
    if (!abrir) return;
    const mesa = abrir;
    if (await hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales })) {
      setAbrir(null);
      irAMesa(mesa.id);
    }
  }

  if (mesaAqui) return <Comanda mesaId={mesaAqui} alSalir={() => setMesaAqui(null)} />;

  return (
    <main className="mx-auto grid max-w-screen-2xl gap-4 p-3 sm:p-4 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="titulo-sala" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 id="titulo-sala" className="sr-only">
            Sala
          </h1>
          <div
            role="tablist"
            aria-label="Zonas"
            className="flex basis-full gap-1 overflow-x-auto sm:flex-1 sm:basis-0"
          >
            {zonas.map((z) => {
              const conAviso = estado.mesas.some(
                (m) =>
                  m.zonaId === z.id &&
                  ["aviso", "qr", "cuenta"].includes(situacionMesa(estado, m).situacion),
              );
              return (
                <button
                  key={z.id}
                  role="tab"
                  type="button"
                  aria-selected={z.id === zonaId}
                  onClick={() => setZonaId(z.id)}
                  className={clsx(
                    "relative h-11 min-w-0 flex-1 shrink-0 rounded-lg px-4 font-rotulo text-xl font-semibold sm:flex-none",
                    z.id === zonaId
                      ? "bg-cobalto text-white"
                      : "bg-white text-tinta ring-1 ring-zinc-oscuro",
                  )}
                >
                  {z.nombre}
                  {conAviso && (
                    <span className="absolute -top-1 -right-1 size-3 rounded-full bg-aviso ring-2 ring-white">
                      <span className="sr-only"> (hay avisos)</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {(ventaRapida || paraLlevar || reservas) && (
            // En el móvil, los tres en una fila con el icono encima; en pantallas grandes, en línea.
            <div className="grid basis-full auto-cols-fr grid-flow-col gap-2 sm:flex sm:basis-auto">
              {ventaRapida && (
                <Link
                  href="/sala/rapida"
                  className={clsx(claseAtajo, "bg-cuenta text-white hover:brightness-95")}
                >
                  <Zap aria-hidden className="size-4" /> Venta rápida
                </Link>
              )}
              {paraLlevar && (
                <button
                  type="button"
                  onClick={() => setNuevoLlevar(true)}
                  className={clsx(claseAtajo, "bg-white ring-1 ring-zinc-oscuro hover:bg-zinc")}
                >
                  <ShoppingBag aria-hidden className="size-4" /> Para llevar
                </button>
              )}
              {reservas && (
                <Link
                  href="/sala/reservas"
                  className={clsx(
                    claseAtajo,
                    "relative bg-white ring-1 ring-zinc-oscuro hover:bg-zinc",
                  )}
                >
                  <CalendarDays aria-hidden className="size-4" /> Reservas
                  {porConfirmar > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-aviso px-1 text-xs text-white ring-2 ring-white sm:static sm:ring-0">
                      {porConfirmar}
                      <span className="sr-only"> por confirmar</span>
                    </span>
                  )}
                </Link>
              )}
            </div>
          )}
          <p className="mr-auto text-sm text-tinta-suave sm:mr-0">
            {ocupadas} {ocupadas === 1 ? "mesa ocupada" : "mesas ocupadas"}
          </p>
          <div
            className="flex rounded-lg bg-white ring-1 ring-zinc-oscuro"
            role="group"
            aria-label="Vista"
          >
            <button
              type="button"
              aria-pressed={vista === "plano"}
              onClick={() => cambiarVista("plano")}
              className={clsx("rounded-l-lg p-2.5", vista === "plano" && "bg-tinta text-white")}
            >
              <IconoPlano aria-hidden className="size-5" />
              <span className="sr-only">Plano</span>
            </button>
            <button
              type="button"
              aria-pressed={vista === "lista"}
              onClick={() => cambiarVista("lista")}
              className={clsx("rounded-r-lg p-2.5", vista === "lista" && "bg-tinta text-white")}
            >
              <List aria-hidden className="size-5" />
              <span className="sr-only">Lista</span>
            </button>
          </div>
        </div>

        {vista === "plano" ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc ring-1 ring-zinc-oscuro sm:aspect-[16/9]">
            <DecoracionesPlano
              decoraciones={(estado.decoraciones ?? []).filter((d) => d.zonaId === zonaId)}
            />
            {mesas.map((m) => (
              <FichaMesa key={m.id} mesa={m} ahora={ahora} alTocar={() => tocarMesa(m)} enPlano />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {mesas.map((m) => (
              <li key={m.id}>
                <FichaMesa mesa={m} ahora={ahora} alTocar={() => tocarMesa(m)} />
              </li>
            ))}
          </ul>
        )}
        <Leyenda />
      </section>

      <aside aria-labelledby="titulo-avisos" className="lg:sticky lg:top-18 lg:self-start">
        {paraLlevar && <ListaParaLlevar />}
        <h2
          id="titulo-avisos"
          className="mb-2 flex items-center gap-2 font-rotulo text-2xl font-bold"
        >
          <BellRing aria-hidden className="size-5" /> Avisos
        </h2>
        {avisos.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-tinta-suave ring-1 ring-zinc">
            Todo tranquilo. Aquí salen las mesas que te llaman, piden la cuenta o hacen un pedido
            desde el QR.
          </p>
        ) : (
          <ul className="space-y-2">
            {avisos.map((a) => (
              <FilaAviso key={a.id} aviso={a} ahora={ahora} />
            ))}
          </ul>
        )}
      </aside>

      <Dialogo
        abierto={abrir !== null}
        alCerrar={() => setAbrir(null)}
        titulo={`Abrir ${abrir?.nombre ?? ""}`}
      >
        {reservaAbrir && (
          <div className="mb-4 rounded-xl bg-cobalto/10 p-3">
            <p className="mb-2">
              Reservada a las <strong>{reservaAbrir.hora}</strong> para {reservaAbrir.nombre} (
              {reservaAbrir.personas}).
              {reservaAbrir.nota && <span className="block text-sm">«{reservaAbrir.nota}»</span>}
            </p>
            <Boton
              variante="primario"
              className="w-full"
              onClick={async () => {
                const mesa = abrir!;
                if (
                  await hacer({
                    tipo: "sentar_reserva",
                    reservaId: reservaAbrir.id,
                    mesaId: mesa.id,
                  })
                ) {
                  setAbrir(null);
                  irAMesa(mesa.id);
                }
              }}
            >
              Han llegado: abrir para {reservaAbrir.personas}
            </Boton>
          </div>
        )}
        <p className="mb-3 font-semibold">¿Cuántas personas?</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Boton
              key={n}
              tamano="grande"
              variante={n === abrir?.plazas ? "primario" : "secundario"}
              onClick={() => abrirMesa(n)}
            >
              {n}
            </Boton>
          ))}
        </div>
      </Dialogo>
      <NuevoParaLlevar
        abierto={nuevoLlevar}
        alCerrar={() => setNuevoLlevar(false)}
        alAbrir={irAMesa}
      />
    </main>
  );
}

function Leyenda() {
  return (
    <ul
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave"
      aria-label="Leyenda de colores"
    >
      {(Object.keys(TEXTO_SITUACION) as SituacionMesa[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={clsx("size-3.5 rounded ring-2", COLOR_SITUACION[s])} />
          {TEXTO_SITUACION[s]}
        </li>
      ))}
    </ul>
  );
}

function FilaAviso({ aviso, ahora }: { aviso: Aviso; ahora: string }) {
  const { estado, hacer } = useDatos();
  const mesa = buscarMesa(estado, aviso.mesaId);
  const Icono = ICONO_AVISO[aviso.tipo];
  const minutos = minutosEntre(aviso.creadoEn, ahora);
  return (
    <li
      className={clsx(
        "flex items-start gap-3 rounded-xl bg-white p-3 ring-2",
        aviso.tipo === "llamar"
          ? "ring-aviso"
          : aviso.tipo === "pedido_qr"
            ? "ring-qr"
            : aviso.tipo === "cuenta"
              ? "ring-cuenta"
              : "ring-zinc",
      )}
    >
      <Icono aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {mesa?.nombre ?? "Mesa"} · {TEXTO_AVISO[aviso.tipo]}
        </p>
        <p className="truncate text-sm text-tinta-suave">{aviso.detalle}</p>
        <p className="text-xs text-tinta-suave" suppressHydrationWarning>
          {formatearHora(aviso.creadoEn)} · hace {minutos} min
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {mesa && (aviso.tipo === "pedido_qr" || aviso.tipo === "cuenta") ? (
          <Link
            href={`/sala/${mesa.id}`}
            className="rounded-lg bg-cobalto px-3 py-1.5 text-sm font-semibold text-white"
          >
            Ver
          </Link>
        ) : null}
        {aviso.tipo !== "pedido_qr" && (
          <Boton
            tamano="pequeno"
            onClick={() => hacer({ tipo: "atender_aviso", avisoId: aviso.id })}
          >
            <CheckCheck aria-hidden className="size-4" /> Hecho
          </Boton>
        )}
      </div>
    </li>
  );
}

function FichaMesa({
  mesa,
  ahora,
  alTocar,
  enPlano,
}: {
  mesa: Mesa;
  ahora: string;
  alTocar: () => void;
  enPlano?: boolean;
}) {
  const { estado } = useDatos();
  const reservas = useFuncion("reservas");
  const s = situacionMesa(estado, mesa);
  const reserva =
    reservas && s.situacion === "libre"
      ? reservaCercana(estado.reservas, mesa.id, ahora)
      : undefined;
  const urgente = s.situacion === "aviso" || s.situacion === "qr";
  return (
    <button
      type="button"
      onClick={alTocar}
      style={
        enPlano
          ? {
              left: `${mesa.x}%`,
              top: `${mesa.y}%`,
              width: `${mesa.ancho}%`,
              height: `${mesa.alto * 1.6}%`,
            }
          : undefined
      }
      className={clsx(
        "flex flex-col items-center justify-center p-1 text-center ring-2 transition active:scale-95",
        enPlano ? "absolute" : "h-28 w-full",
        mesa.forma === "redonda" ? "rounded-full" : "rounded-xl",
        COLOR_SITUACION[s.situacion],
        urgente && "latido",
      )}
    >
      <span className="font-rotulo text-lg leading-none font-bold sm:text-xl">
        {mesa.nombre}
        {(s.situacion === "libre" || s.situacion === "ocupada") && (
          <span className="sr-only">, {TEXTO_SITUACION[s.situacion].toLowerCase()}</span>
        )}
      </span>
      {s.cuenta ? (
        <>
          <span className="text-sm font-semibold">{euros(s.total)}</span>
          <span
            className="flex items-center gap-2 text-xs text-tinta-suave"
            suppressHydrationWarning
          >
            <span className="flex items-center gap-0.5">
              <Users aria-hidden className="size-3" />
              {s.cuenta.comensales}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock aria-hidden className="size-3" />
              {minutosEntre(s.cuenta.abiertaEn, ahora)}′
            </span>
          </span>
        </>
      ) : reserva ? (
        <span className="rounded bg-cobalto px-1 text-[11px] font-semibold text-white">
          Reserva {reserva.hora}
        </span>
      ) : (
        <span className="text-xs text-tinta-suave">{mesa.plazas} pax</span>
      )}
      {s.situacion !== "libre" && s.situacion !== "ocupada" && (
        <span className="mt-0.5 rounded bg-white/80 px-1 text-[11px] font-semibold">
          {TEXTO_SITUACION[s.situacion]}
        </span>
      )}
      {s.listos > 0 && (
        <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-semibold text-cuenta">
          <UtensilsCrossed aria-hidden className="size-3" /> Listo
        </span>
      )}
    </button>
  );
}
