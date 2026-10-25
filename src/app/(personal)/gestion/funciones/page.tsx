import type { Metadata } from "next";
import { Funciones } from "./funciones";

export const metadata: Metadata = { title: "Funciones" };

export default function PaginaFunciones() {
  return <Funciones />;
}
