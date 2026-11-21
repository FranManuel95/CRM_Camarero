"use client";

import clsx from "clsx";
import { ArrowRight, CircleHelp, Mic, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada, Dialogo } from "@/components/ui";
import {
  avisoPara,
  buscarAyuda,
  datosQuePide,
  entradaPorId,
  MANUAL,
  rutaCon,
  TEMAS,
  type DatoContexto,
  type EntradaAyuda,
  type QuienPregunta,
} from "@/lib/ayuda";
import { disponible } from "@/lib/dominio/funciones";
import { totalCuenta, euros } from "@/lib/dominio/importes";
import { puede } from "@/lib/dominio/permisos";
import { nombreLlevar } from "@/lib/dominio/selectores";

/** Lo que más se pregunta, para tenerlo a un toque antes de escribir nada. */
const FRECUENTES = {
  camarero: [
    "cobrar-partes",
    "precio-linea",
    "anular-linea",
    "mover-mesa",
    "para-despues",
    "sin-wifi",
  ],
  encargado: [
    "precio-linea",
    "subir-precios",
    "cerrar-caja",
    "rectificar",
    "vincular",
    "impresora-falla",
  ],
};

type ReconocimientoVoz = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
};

type ClaseVoz = new () => ReconocimientoVoz;

/** El reconocimiento de voz del navegador, si lo tiene (Chrome, Edge, Safari…). */
function claseVoz(): ClaseVoz | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, ClaseVoz | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Ayuda de la app: buscas o dices tu duda y sale cómo se hace, con los nombres de los botones, y
 * «Llévame ahí» para abrir la pantalla exacta (preguntando, si hace falta, de qué mesa o qué
 * producto). Sale del manual de `src/lib/ayuda`, que cubre todas las acciones y pantallas.
 */
export function Ayuda({ className }: { className?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={className}
        aria-haspopup="dialog"
      >
        <CircleHelp aria-hidden className="size-5 sm:size-4" />
        Ayuda
      </button>
      <Dialogo
        abierto={abierta}
        alCerrar={() => setAbierta(false)}
        titulo="Ayuda"
        ancho="max-w-2xl"
      >
        {abierta && <Contenido alIr={() => setAbierta(false)} />}
      </Dialogo>
    </>
  );
}

function Contenido({ alIr }: { alIr: () => void }) {
  const { estado, empleado } = useDatos();
  const [texto, setTexto] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [hayVoz] = useState(() => Boolean(claseVoz()));
  const quien: QuienPregunta = useMemo(() => {
    const yo = estado.empleados.find((e) => e.id === empleado.id) ?? { ...empleado };
    return {
      rol: empleado.rol,
      puede: (p) => puede(estado.ajustes, yo, p),
      activa: (f) => disponible(estado.ajustes, estado.servicios, f),
    };
  }, [empleado, estado.empleados, estado.ajustes, estado.servicios]);
  const resultados = texto.trim()
    ? buscarAyuda(MANUAL, texto, quien)
    : FRECUENTES[empleado.rol]
        .map((id) => entradaPorId(id))
        .filter((e): e is EntradaAyuda => Boolean(e))
        .map((entrada) => ({ entrada, puntos: 0, aviso: avisoPara(entrada, quien) }));

  function dictar() {
    const Clase = claseVoz();
    if (!Clase) return;
    const voz = new Clase();
    voz.lang = "es-ES";
    voz.interimResults = false;
    voz.onresult = (e) => setTexto(e.results[0]?.[0]?.transcript ?? "");
    voz.onend = () => setEscuchando(false);
    setEscuchando(true);
    voz.start();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-3 left-3 size-5 text-tinta-suave"
          />
          <input
            type="search"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué quieres hacer? Por ejemplo: cambiar el precio al cobrar"
            aria-label="¿Qué quieres hacer?"
            className={clsx(claseEntrada, "pl-10")}
          />
        </div>
        {hayVoz && (
          <Boton
            onClick={dictar}
            disabled={escuchando}
            aria-label={escuchando ? "Escuchando…" : "Decirlo en voz alta"}
          >
            <Mic aria-hidden className={clsx("size-5", escuchando && "text-aviso")} />
          </Boton>
        )}
      </div>

      <div aria-live="polite">
        {!texto.trim() && <p className="mb-2 text-sm text-tinta-suave">Lo que más se pregunta:</p>}
        {resultados.length === 0 ? (
          <p className="rounded-xl bg-zinc-claro p-4 text-sm">
            No encuentro nada con eso. Prueba con otras palabras: «cobrar», «impresora», «precio»…
          </p>
        ) : (
          <ul className="space-y-2">
            {resultados.map((r, i) => (
              <Respuesta
                key={r.entrada.id}
                entrada={r.entrada}
                aviso={r.aviso}
                abierta={i === 0 && Boolean(texto.trim())}
                alIr={alIr}
              />
            ))}
          </ul>
        )}
      </div>

      {!texto.trim() && <Temas quien={quien} alIr={alIr} />}
    </div>
  );
}

/** Todo el manual por temas y subtemas, para quien prefiere mirar a buscar. */
function Temas({ quien, alIr }: { quien: QuienPregunta; alIr: () => void }) {
  return (
    <section aria-labelledby="t-temas">
      <h3 id="t-temas" className="mb-2 font-rotulo text-xl font-bold">
        Todo, por temas
      </h3>
      <ul className="space-y-2">
        {TEMAS.map((t) => {
          const total = t.subtemas.reduce((n, s) => n + s.entradas.length, 0);
          return (
            <li key={t.id}>
              <details className="rounded-xl bg-zinc-claro">
                <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 font-semibold">
                  {t.nombre}
                  <span className="text-sm font-normal text-tinta-suave">
                    {total} {total === 1 ? "pregunta" : "preguntas"}
                  </span>
                </summary>
                <div className="space-y-4 px-3 pb-3">
                  {t.subtemas.map((s) => (
                    <div key={s.nombre}>
                      <h4 className="mb-1.5 text-sm font-bold tracking-wide text-tinta-suave uppercase">
                        {s.nombre}
                      </h4>
                      <ul className="space-y-2">
                        {s.entradas
                          .map((id) => entradaPorId(id))
                          .filter((e): e is EntradaAyuda => Boolean(e))
                          .map((entrada) => (
                            <Respuesta
                              key={entrada.id}
                              entrada={entrada}
                              aviso={avisoPara(entrada, quien)}
                              abierta={false}
                              alIr={alIr}
                              fondo
                            />
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Respuesta({
  entrada,
  aviso,
  abierta,
  alIr,
  fondo = false,
}: {
  entrada: EntradaAyuda;
  aviso?: string;
  abierta: boolean;
  alIr: () => void;
  /** Dentro de un tema: con fondo blanco, para que se distinga. */
  fondo?: boolean;
}) {
  const router = useRouter();
  const { empleado } = useDatos();
  const [eligiendo, setEligiendo] = useState(false);
  const pide = datosQuePide(entrada.ruta);
  // Si no puede hacerlo, no tiene sentido llevarle: el aviso le dice quién lo hace. Si solo
  // está apagado y es el encargado, le lleva a encenderlo.
  const puedeIr = entrada.ruta && !aviso;
  const aFunciones = aviso?.includes("Funciones") && empleado.rol === "encargado";

  function ir(ruta: string) {
    alIr();
    router.push(ruta);
  }

  return (
    <li className={clsx("rounded-xl ring-1 ring-zinc", fondo && "bg-white")}>
      <details open={abierta} className="group">
        <summary className="cursor-pointer list-none p-3 font-semibold">
          {entrada.titulo}
          {aviso && <span className="mt-0.5 block text-sm font-normal text-aviso">{aviso}</span>}
        </summary>
        <div className="space-y-3 border-t border-zinc p-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {entrada.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {entrada.nota && <p className="text-sm text-tinta-suave">{entrada.nota}</p>}
          {puedeIr && !eligiendo && (
            <Boton
              variante="primario"
              onClick={() => (pide.length ? setEligiendo(true) : ir(rutaCon(entrada.ruta!, {})))}
            >
              Llévame ahí <ArrowRight aria-hidden className="size-4" />
            </Boton>
          )}
          {aFunciones && (
            <Boton onClick={() => ir("/gestion/funciones")}>
              Ir a Funciones <ArrowRight aria-hidden className="size-4" />
            </Boton>
          )}
          {eligiendo && (
            <Elegir pide={pide} alTerminar={(datos) => ir(rutaCon(entrada.ruta!, datos))} />
          )}
        </div>
      </details>
    </li>
  );
}

const PREGUNTA: Record<DatoContexto, string> = {
  mesa: "¿De qué mesa?",
  linea: "¿Qué producto de la cuenta?",
  producto: "¿Qué producto?",
  cliente: "¿Qué cliente?",
};

/** Pregunta, uno detrás de otro, los datos que necesita el enlace, con botones. */
function Elegir({
  pide,
  alTerminar,
}: {
  pide: DatoContexto[];
  alTerminar: (datos: Partial<Record<DatoContexto, string>>) => void;
}) {
  const { estado } = useDatos();
  const [datos, setDatos] = useState<Partial<Record<DatoContexto, string>>>({});
  const [filtro, setFiltro] = useState("");
  const falta = pide.find((d) => !datos[d]);

  function elegir(d: DatoContexto, valor: string) {
    const nuevos = { ...datos, [d]: valor };
    setFiltro("");
    if (pide.every((x) => nuevos[x])) alTerminar(nuevos);
    else setDatos(nuevos);
  }

  if (!falta) return null;
  const f = filtro.trim().toLowerCase();
  let opciones: { valor: string; texto: string }[] = [];
  if (falta === "mesa")
    opciones = estado.cuentas
      .filter((c) => c.estado === "abierta")
      .map((c) => ({
        valor: c.mesaId,
        texto: `${
          c.llevar
            ? nombreLlevar(c.llevar)
            : (estado.mesas.find((m) => m.id === c.mesaId)?.nombre ?? "Mesa")
        } · ${euros(totalCuenta(c))}`,
      }));
  else if (falta === "linea") {
    const cuenta = estado.cuentas.find((c) => c.mesaId === datos.mesa && c.estado === "abierta");
    opciones = (cuenta?.lineas ?? [])
      .filter((l) => l.estado !== "anulada" && l.estado !== "por_confirmar" && !l.ticketId)
      .map((l) => ({ valor: l.id, texto: `${l.cantidad}× ${l.nombre}` }));
  } else if (falta === "producto")
    opciones = [...estado.productos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => ({ valor: p.id, texto: p.nombre }));
  else
    opciones = [...(estado.clientes ?? [])]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((c) => ({ valor: c.id, texto: c.nombre }));
  const muchas = opciones.length > 12;
  const vistas = opciones.filter((o) => !f || o.texto.toLowerCase().includes(f)).slice(0, 24);

  return (
    <fieldset className="rounded-xl bg-zinc-claro p-3">
      <legend className="mb-2 font-semibold">{PREGUNTA[falta]}</legend>
      {muchas && (
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar…"
          aria-label={`Buscar: ${PREGUNTA[falta]}`}
          className={clsx(claseEntrada, "mb-2")}
        />
      )}
      {vistas.length === 0 ? (
        <p className="text-sm">
          {falta === "mesa" ? "Ahora no hay ninguna mesa abierta." : "No hay nada que elegir."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {vistas.map((o) => (
            <Boton key={o.valor} tamano="pequeno" onClick={() => elegir(falta, o.valor)}>
              {o.texto}
            </Boton>
          ))}
        </div>
      )}
    </fieldset>
  );
}
