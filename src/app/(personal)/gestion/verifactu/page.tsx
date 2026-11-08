import type { Metadata } from "next";
import { Verifactu } from "./verifactu";

export const metadata: Metadata = { title: "VERI*FACTU" };

/** Se ve también con la función apagada: para prepararlo y comprobarlo antes de encenderlo. */
export default function PaginaVerifactu() {
  return <Verifactu />;
}
