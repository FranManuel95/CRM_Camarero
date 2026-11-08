import type { Metadata } from "next";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { declaracionResponsable, productorDe } from "@/lib/dominio/declaracion";
import { enLaNube } from "@/lib/servidor/almacen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Declaración responsable" };

/** La declaración responsable de VERI*FACTU, legible dentro del programa (Orden HAC/1177/2024). */
export default function PaginaDeclaracion() {
  const d = declaracionResponsable(productorDe(process.env), enLaNube());
  return (
    <PaginaCuenta titulo="Declaración responsable" ancho="max-w-2xl">
      {d.faltan.length > 0 && (
        <p role="status" className="mb-6 rounded-xl bg-aviso/10 p-3 text-sm font-semibold">
          Borrador sin firmar: faltan datos del fabricante ({d.faltan.join(", ")}).
        </p>
      )}
      <article className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc">
        <h2 className="font-bold">{d.titulo}</h2>
        <dl className="space-y-3">
          {d.datos.map((x) => (
            <div key={x.letra}>
              <dt className="text-sm text-tinta-suave">
                {x.letra}) {x.texto}:
              </dt>
              <dd className="font-semibold text-pretty">{x.valor}</dd>
            </div>
          ))}
        </dl>
        <h2 className="pt-4 font-bold">Anexo</h2>
        {d.anexo.map((s) => (
          <section key={s.titulo}>
            <h3 className="font-semibold">{s.titulo}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {s.parrafos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>
      <p className="mt-4 text-sm">
        <a href="/api/declaracion" className="font-semibold text-cobalto underline" download>
          Descargarla en texto
        </a>
      </p>
    </PaginaCuenta>
  );
}
