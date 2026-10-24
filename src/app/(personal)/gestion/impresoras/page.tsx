import type { Metadata } from "next";
import { Impresoras } from "./impresoras";

export const metadata: Metadata = { title: "Impresoras" };

export default function PaginaImpresoras() {
  return <Impresoras />;
}
