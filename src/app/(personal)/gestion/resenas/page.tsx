import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Resenas } from "./resenas";

export const metadata: Metadata = { title: "Reseñas" };

export default function PaginaResenas() {
  return (
    <SiFuncion funcion="resenas">
      <Resenas />
    </SiFuncion>
  );
}
