import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { SiFuncion } from "@/components/funcion-apagada";
import { Fichajes } from "./fichajes";

export const metadata: Metadata = { title: "Fichajes" };

export default function PaginaFichajes() {
  return (
    <SiFuncion funcion="fichajes">
      <Fichajes nube={enLaNube()} />
    </SiFuncion>
  );
}
