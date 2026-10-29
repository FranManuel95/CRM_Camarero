"use client";

import { Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, claseEntrada } from "@/components/ui";
import { reducir } from "@/lib/cliente/subir-foto";
import { leerEuros } from "@/lib/dominio/importes";
import type { Alergeno, Destino } from "@/lib/dominio/tipos";

type Plato = {
  clave: string;
  incluir: boolean;
  nombre: string;
  descripcion: string;
  precio: string;
  alergenos: Alergeno[];
};
type Seccion = { clave: string; nombre: string; destino: Destino; productos: Plato[] };

type Leida = {
  categorias: {
    nombre: string;
    destino: Destino;
    productos: { nombre: string; descripcion: string; precio: number; alergenos: Alergeno[] }[];
  }[];
};

const aTexto = (euros: number) => (euros ? euros.toFixed(2).replace(".", ",") : "");

/**
 * Cargar la carta desde una foto o un PDF: la lee la IA, el encargado la repasa (nombres,
 * precios, qué entra) y se da de alta de golpe. Lo que ya está en la carta no se toca.
 */
export function CartaDesdeFoto() {
  const { estado, hacer } = useDatos();
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState("");
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  if (!estado.servicios.ia) return null;

  async function leer(archivo: File) {
    setLeyendo(true);
    setError("");
    setSecciones(null);
    try {
      const esPdf = archivo.type === "application/pdf";
      const cuerpo = esPdf ? archivo : await reducir(archivo, 2400, "image/jpeg");
      const r = await fetch("/api/carta-foto", {
        method: "POST",
        headers: { "Content-Type": esPdf ? "application/pdf" : "image/jpeg" },
        body: cuerpo,
      });
      const datos = (await r.json()) as Leida & { error?: string };
      if (!r.ok) throw new Error(datos.error ?? "No se ha podido leer la carta.");
      setSecciones(
        datos.categorias.map((c, i) => ({
          clave: `c${i}`,
          nombre: c.nombre,
          destino: c.destino,
          productos: c.productos.map((p, j) => ({
            clave: `c${i}p${j}`,
            incluir: p.precio > 0,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: aTexto(p.precio),
            alergenos: p.alergenos,
          })),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido leer la carta.");
    } finally {
      setLeyendo(false);
    }
  }

  const cambiar = (clave: string, cambios: Partial<Plato>) =>
    setSecciones((ss) =>
      ss!.map((s) => ({
        ...s,
        productos: s.productos.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)),
      })),
    );

  const elegidos = (secciones ?? []).flatMap((s) => s.productos.filter((p) => p.incluir));
  const malos = elegidos.filter((p) => !p.nombre.trim() || !leerEuros(p.precio));

  async function darDeAlta() {
    const categorias = secciones!
      .map((s) => ({
        nombre: s.nombre.trim() || "Sin categoría",
        destino: s.destino,
        productos: s.productos
          .filter((p) => p.incluir)
          .map((p) => ({
            nombre: p.nombre.trim(),
            descripcion: p.descripcion.trim(),
            precio: leerEuros(p.precio) ?? 0,
            alergenos: p.alergenos,
          })),
      }))
      .filter((c) => c.productos.length);
    if (
      await hacer(
        { tipo: "importar_carta", categorias },
        `Carta cargada: ${elegidos.length} productos`,
      )
    )
      setSecciones(null);
  }

  return (
    <section className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-zinc" aria-labelledby="t-foto">
      <h2 id="t-foto" className="font-rotulo text-2xl font-bold">
        Cargar la carta desde una foto
      </h2>
      <p className="mt-1 mb-3 text-sm text-tinta-suave">
        Haz una foto a tu carta (o sube el PDF) y la pasamos a productos con sus precios. Antes de
        guardar, repásala: lo que ya tienes en la carta no se duplica.
      </p>
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-cobalto px-4 font-semibold text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalto">
        {leyendo ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Camera aria-hidden className="size-4" />
        )}
        {leyendo ? "Leyendo la carta… (puede tardar un minuto)" : "Elegir foto o PDF"}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          disabled={leyendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void leer(f);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-aviso-claro p-3 text-sm">
          {error}
        </p>
      )}

      {secciones && (
        <div className="mt-4 space-y-4">
          {secciones.map((s) => (
            <fieldset key={s.clave} className="rounded-xl p-3 ring-1 ring-zinc">
              <legend className="sr-only">Categoría {s.nombre}</legend>
              <div className="mb-2 flex flex-wrap gap-2">
                <input
                  aria-label="Nombre de la categoría"
                  className={`${claseEntrada} max-w-xs font-semibold`}
                  value={s.nombre}
                  onChange={(e) =>
                    setSecciones((ss) =>
                      ss!.map((x) => (x.clave === s.clave ? { ...x, nombre: e.target.value } : x)),
                    )
                  }
                />
                <select
                  aria-label={`A dónde va ${s.nombre}`}
                  className={`${claseEntrada} w-auto`}
                  value={s.destino}
                  onChange={(e) =>
                    setSecciones((ss) =>
                      ss!.map((x) =>
                        x.clave === s.clave ? { ...x, destino: e.target.value as Destino } : x,
                      ),
                    )
                  }
                >
                  <option value="cocina">Va a cocina</option>
                  <option value="barra">Va a barra</option>
                </select>
              </div>
              <ul className="divide-y divide-zinc">
                {s.productos.map((p) => (
                  <li key={p.clave} className="flex flex-wrap items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={p.incluir}
                      aria-label={`Dar de alta ${p.nombre}`}
                      onChange={(e) => cambiar(p.clave, { incluir: e.target.checked })}
                    />
                    <input
                      aria-label="Nombre"
                      className={`${claseEntrada} min-w-0 flex-1`}
                      value={p.nombre}
                      onChange={(e) => cambiar(p.clave, { nombre: e.target.value })}
                    />
                    <input
                      aria-label={`Precio de ${p.nombre}`}
                      inputMode="decimal"
                      className={`${claseEntrada} w-24 text-right`}
                      value={p.precio}
                      placeholder="0,00"
                      onChange={(e) => cambiar(p.clave, { precio: e.target.value })}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {malos.length > 0 && (
              <p className="mr-auto text-sm text-aviso">
                Revisa {malos.length} {malos.length === 1 ? "producto" : "productos"} sin nombre o
                sin precio.
              </p>
            )}
            <Boton variante="fantasma" onClick={() => setSecciones(null)}>
              Descartar
            </Boton>
            <Boton
              variante="primario"
              disabled={!elegidos.length || malos.length > 0}
              onClick={darDeAlta}
            >
              Dar de alta {elegidos.length} productos
            </Boton>
          </div>
          <p className="text-xs text-tinta-suave">
            El IVA será el de Ajustes ({estado.ajustes.ivaPorDefecto} %). Los alérgenos solo se
            rellenan si la carta los indica: repásalos en cada plato.
          </p>
        </div>
      )}
    </section>
  );
}
