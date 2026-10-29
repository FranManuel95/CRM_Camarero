"use client";

import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useDatos } from "@/components/datos-personal";
import { Boton, Campo, claseEntrada, Dialogo, Interruptor } from "@/components/ui";
import { reducir } from "@/lib/cliente/subir-foto";
import { euros, leerEuros } from "@/lib/dominio/importes";
import { leerCantidad, type PedidoLeido } from "@/lib/dominio/stock";
import type { Centimos, MetodoGasto } from "@/lib/dominio/tipos";

export type PedidoInicial = {
  proveedor: string;
  lineas: { ingredienteId: string; cantidad: number; importe: Centimos }[];
};

type Linea = { clave: number; ingredienteId: string; cantidad: string; importe: string };

const aTexto = (n: number) => String(n).replace(".", ",");
const aEuros = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

let siguiente = 0;
const nuevaLinea = (l?: PedidoInicial["lineas"][number]): Linea => ({
  clave: ++siguiente,
  ingredienteId: l?.ingredienteId ?? "",
  cantidad: l ? aTexto(l.cantidad) : "",
  importe: l ? aEuros(l.importe) : "",
});

/** Llega un pedido: lo que ha venido suma al stock y, si se quiere, se apunta el gasto. */
export function RecibirPedido({
  inicial,
  alCerrar,
  leerFacturas,
}: {
  inicial: PedidoInicial | null;
  alCerrar: () => void;
  leerFacturas: boolean;
}) {
  return (
    <Dialogo
      abierto={inicial !== null}
      alCerrar={alCerrar}
      titulo="Recibir pedido"
      ancho="max-w-2xl"
    >
      {inicial && <Formulario inicial={inicial} alCerrar={alCerrar} leerFacturas={leerFacturas} />}
    </Dialogo>
  );
}

function Formulario({
  inicial,
  alCerrar,
  leerFacturas,
}: {
  inicial: PedidoInicial;
  alCerrar: () => void;
  leerFacturas: boolean;
}) {
  const { estado, hacer } = useDatos();
  const [proveedor, setProveedor] = useState(inicial.proveedor);
  const [lineas, setLineas] = useState<Linea[]>(() =>
    inicial.lineas.length ? inicial.lineas.map(nuevaLinea) : [nuevaLinea()],
  );
  const [apuntarGasto, setApuntarGasto] = useState(true);
  const [iva, setIva] = useState(10);
  const [metodo, setMetodo] = useState<MetodoGasto>("tarjeta");
  const [deCaja, setDeCaja] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<{ error?: string; sinCasar?: string[] } | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);

  const ingredientes = [...estado.ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const proveedores = [
    ...new Set(estado.ingredientes.map((i) => i.proveedor.trim()).filter(Boolean)),
  ].sort();

  const leidas = lineas.map((l) => ({
    ...l,
    ing: estado.ingredientes.find((i) => i.id === l.ingredienteId),
    n: leerCantidad(l.cantidad),
    euros: l.importe ? leerEuros(l.importe) : 0,
  }));
  const usadas = leidas.filter((l) => l.ingredienteId);
  const valido =
    usadas.length > 0 && usadas.every((l) => l.ing && l.n !== null && l.n > 0 && l.euros !== null);
  const total = usadas.reduce((s, l) => s + (l.euros ?? 0), 0);

  function cambiar(clave: number, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  }

  async function leerFoto(archivo: File) {
    setLeyendo(true);
    setLectura(null);
    try {
      const foto = await reducir(archivo, 2000, "image/jpeg");
      const r = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: foto,
      });
      const datos = (await r.json()) as PedidoLeido & { error?: string };
      if (!r.ok) throw new Error(datos.error ?? "No se ha podido leer la factura.");
      if (datos.proveedor) setProveedor(datos.proveedor);
      setIva(datos.iva);
      if (datos.lineas.length) setLineas(datos.lineas.map(nuevaLinea));
      setLectura({ sinCasar: datos.sinCasar });
    } catch (e) {
      setLectura({ error: e instanceof Error ? e.message : "No se ha podido leer la factura." });
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    if (!valido) return;
    const ok = await hacer(
      {
        tipo: "recibir_compra",
        proveedor: proveedor.trim(),
        lineas: usadas.map((l) => ({
          ingredienteId: l.ingredienteId,
          cantidad: l.n ?? 0,
          importe: l.euros ?? 0,
        })),
        apuntarGasto: apuntarGasto && total > 0,
        iva,
        metodo,
        deCaja: apuntarGasto && deCaja,
      },
      "Pedido recibido: el stock está al día",
    );
    if (ok) alCerrar();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
      className="grid gap-4"
    >
      {leerFacturas && (
        <div className="rounded-xl bg-cobalto-claro p-3">
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = "";
              if (archivo) void leerFoto(archivo);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Boton
              variante="primario"
              disabled={leyendo}
              onClick={() => entradaFoto.current?.click()}
            >
              {leyendo ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Camera aria-hidden className="size-4" />
              )}
              {leyendo ? "Leyendo la factura…" : "Leer la factura con una foto"}
            </Boton>
            <p className="flex-1 text-sm text-tinta-suave">
              Rellena las líneas sola. Revísalas antes de guardar.
            </p>
          </div>
          <div aria-live="polite">
            {lectura?.error && (
              <p className="mt-2 text-sm font-semibold text-aviso">{lectura.error}</p>
            )}
            {lectura?.sinCasar && lectura.sinCasar.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Sin ingrediente en el almacén:</span>{" "}
                {lectura.sinCasar.join(", ")}.
              </p>
            )}
          </div>
        </div>
      )}

      <Campo etiqueta="Proveedor">
        <input
          className={claseEntrada}
          list="proveedores-pedido"
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
        />
        <datalist id="proveedores-pedido">
          {proveedores.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Campo>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Lo que ha llegado</legend>
        <ul className="grid gap-2">
          {leidas.map((l, i) => (
            <li
              key={l.clave}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-zinc pb-2 last:border-0 sm:grid-cols-[1fr_6rem_6rem_auto] sm:border-0 sm:pb-0"
            >
              <select
                aria-label={`Ingrediente de la línea ${i + 1}`}
                className={`${claseEntrada} col-span-3 sm:col-span-1`}
                value={l.ingredienteId}
                onChange={(e) => cambiar(l.clave, { ingredienteId: e.target.value })}
              >
                <option value="">Elige…</option>
                {ingredientes.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.nombre}
                  </option>
                ))}
              </select>
              <span className="relative">
                <input
                  aria-label={`Cantidad de la línea ${i + 1}${l.ing ? ` (${l.ing.unidad})` : ""}`}
                  inputMode="decimal"
                  className={`${claseEntrada} pr-8`}
                  value={l.cantidad}
                  onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })}
                  placeholder="0"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-tinta-suave"
                >
                  {l.ing?.unidad}
                </span>
              </span>
              <span className="relative">
                <input
                  aria-label={`Importe con IVA de la línea ${i + 1}`}
                  inputMode="decimal"
                  className={`${claseEntrada} pr-6`}
                  value={l.importe}
                  onChange={(e) => cambiar(l.clave, { importe: e.target.value })}
                  placeholder="0,00"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-tinta-suave"
                >
                  €
                </span>
              </span>
              <Boton
                variante="fantasma"
                aria-label={`Quitar la línea ${i + 1}`}
                disabled={lineas.length === 1}
                onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
              >
                <Trash2 aria-hidden className="size-4" />
              </Boton>
            </li>
          ))}
        </ul>
        <Boton
          tamano="pequeno"
          className="mt-2"
          onClick={() => setLineas((ls) => [...ls, nuevaLinea()])}
        >
          <Plus aria-hidden className="size-4" /> Otra línea
        </Boton>
      </fieldset>

      <div className="rounded-xl bg-zinc-claro p-3">
        <Interruptor
          activo={apuntarGasto}
          alCambiar={setApuntarGasto}
          etiqueta={`Apuntar el gasto${total ? ` (${euros(total)})` : ""}`}
          ayuda="Sale en Gastos como «Proveedores y género». Si ya lo apuntaste, quítalo."
        />
        {apuntarGasto && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="IVA de la factura">
              <select
                className={claseEntrada}
                value={iva}
                onChange={(e) => setIva(Number(e.target.value))}
              >
                {[0, 4, 10, 21].map((t) => (
                  <option key={t} value={t}>
                    {t} %
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Forma de pago">
              <select
                className={claseEntrada}
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoGasto)}
              >
                <option value="tarjeta">Tarjeta o transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="bizum">Bizum</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
            <div className="sm:col-span-2">
              <Interruptor
                activo={deCaja}
                alCambiar={(v) => {
                  setDeCaja(v);
                  if (v) setMetodo("efectivo");
                }}
                etiqueta="Pagado con dinero de la caja"
                ayuda="Sale como retirada en el arqueo de hoy."
              />
            </div>
          </div>
        )}
      </div>

      <Boton type="submit" variante="primario" tamano="grande" disabled={!valido}>
        Sumar al stock
      </Boton>
    </form>
  );
}
