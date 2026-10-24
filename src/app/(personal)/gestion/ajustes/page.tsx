import type { Metadata } from "next";
import { Ajustes } from "./ajustes";

export const metadata: Metadata = { title: "Ajustes" };

export default function PaginaAjustes() {
  return <Ajustes />;
}
