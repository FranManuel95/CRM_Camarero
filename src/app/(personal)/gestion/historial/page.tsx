import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Historial } from "./historial";

export const metadata: Metadata = { title: "Historial" };

export default function PaginaHistorial() {
  return (
    <SiFuncion funcion="historial">
      <Historial />
    </SiFuncion>
  );
}
