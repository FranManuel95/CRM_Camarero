import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { Fichajes } from "./fichajes";

export const metadata: Metadata = { title: "Fichajes" };

export default function PaginaFichajes() {
  return <Fichajes nube={enLaNube()} />;
}
