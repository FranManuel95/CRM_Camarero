import type { TextoLegal } from "@/lib/dominio/legal";

/** Aviso legal, privacidad y cookies, cada uno con su ancla (#privacidad…). */
export function TextoLegalVista({ texto }: { texto: TextoLegal }) {
  return (
    <div className="space-y-8">
      <nav aria-label="Apartados" className="flex flex-wrap gap-2 text-sm font-semibold">
        {texto.secciones.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full bg-cobalto-claro px-3 py-1 text-cobalto-oscuro"
          >
            {s.titulo}
          </a>
        ))}
      </nav>
      {texto.secciones.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-2">
          <h2 className="font-rotulo text-2xl font-bold">{s.titulo}</h2>
          {s.parrafos.map((p, i) => (
            <p key={i} className="leading-relaxed text-pretty">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
