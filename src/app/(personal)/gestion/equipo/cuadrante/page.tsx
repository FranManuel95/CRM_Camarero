import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Cuadrante } from "./cuadrante";

export const metadata: Metadata = { title: "Cuadrante" };

export default function PaginaCuadrante() {
  return (
    <SiFuncion funcion="cuadrante">
      <Cuadrante />
    </SiFuncion>
  );
}
