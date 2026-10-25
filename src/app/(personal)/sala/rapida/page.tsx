import type { Metadata } from "next";
import { VentaRapida } from "./venta-rapida";

export const metadata: Metadata = { title: "Venta rápida" };

export default function PaginaVentaRapida() {
  return <VentaRapida />;
}
