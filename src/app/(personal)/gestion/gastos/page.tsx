import type { Metadata } from "next";
import { Gastos } from "./gastos";

export const metadata: Metadata = { title: "Gastos" };

export default function PaginaGastos() {
  return <Gastos />;
}
