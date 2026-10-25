import type { Metadata } from "next";
import { Stock } from "./stock";

export const metadata: Metadata = { title: "Stock" };

export default function PaginaStock() {
  // La lectura de facturas con foto solo sale si el servidor tiene la clave de la IA.
  return <Stock leerFacturas={Boolean(process.env.ANTHROPIC_API_KEY)} />;
}
