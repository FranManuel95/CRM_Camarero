import type { Metadata } from "next";
import { Cuadrante } from "./cuadrante";

export const metadata: Metadata = { title: "Cuadrante" };

export default function PaginaCuadrante() {
  return <Cuadrante />;
}
