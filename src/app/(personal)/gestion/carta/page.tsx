import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { EditorCarta } from "./editor-carta";
import { CartaDesdeFoto } from "./carta-foto";
import { Cartas } from "./cartas";
import { SubirPrecios } from "./subir-precios";
import { Tarifas } from "./tarifas";

export const metadata: Metadata = { title: "Carta" };

export default async function PaginaCarta({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const { producto } = await searchParams;
  return (
    <>
      <EditorCarta
        key={producto}
        abrirProducto={producto}
        clavePublica={enLaNube() ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "") : ""}
      />
      <Cartas />
      <CartaDesdeFoto />
      <SubirPrecios />
      <Tarifas />
    </>
  );
}
