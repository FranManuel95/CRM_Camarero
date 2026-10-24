import type { Metadata } from "next";
import { Resumen } from "./resumen";

export const metadata: Metadata = { title: "Gestión" };

export default function PaginaGestion() {
  return <Resumen />;
}
