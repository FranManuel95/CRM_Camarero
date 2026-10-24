import type { Metadata } from "next";
import { Informes } from "./informes";

export const metadata: Metadata = { title: "Informes" };

export default function PaginaInformes() {
  return <Informes />;
}
