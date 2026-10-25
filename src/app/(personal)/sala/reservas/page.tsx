import type { Metadata } from "next";
import { Reservas } from "./reservas";

export const metadata: Metadata = { title: "Reservas" };

export default function PaginaReservas() {
  return <Reservas />;
}
