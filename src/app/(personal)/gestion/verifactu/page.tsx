import type { Metadata } from "next";
import { SiFuncion } from "@/components/funcion-apagada";
import { Verifactu } from "./verifactu";

export const metadata: Metadata = { title: "VERI*FACTU" };

export default function PaginaVerifactu() {
  return (
    <SiFuncion funcion="verifactu">
      <Verifactu />
    </SiFuncion>
  );
}
