import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { EditorCarta } from "./editor-carta";
import { Tarifas } from "./tarifas";

export const metadata: Metadata = { title: "Carta" };

export default function PaginaCarta() {
  return (
    <>
      <EditorCarta
        clavePublica={enLaNube() ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "") : ""}
      />
      <Tarifas />
    </>
  );
}
