import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Stock } from "./stock";

export const metadata: Metadata = { title: "Stock" };

export default function PaginaStock() {
  return (
    <SiFuncion funcion="stock">
      <Stock />
    </SiFuncion>
  );
}
