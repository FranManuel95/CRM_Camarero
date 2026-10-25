import type { Metadata } from "next";
import { enLaNube } from "@/lib/servidor/almacen";
import { Equipo } from "./equipo";

export const metadata: Metadata = { title: "Equipo" };

export default function PaginaEquipo() {
  return <Equipo nube={enLaNube()} />;
}
