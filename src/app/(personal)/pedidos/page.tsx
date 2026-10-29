import type { Metadata } from "next";
import { PantallaPedidos } from "./pantalla";

export const metadata: Metadata = { title: "Pedidos" };

export default function PaginaPedidos() {
  return <PantallaPedidos />;
}
