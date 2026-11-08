import type { Metadata } from "next";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { TextoLegalVista } from "@/components/texto-legal";
import { legalDePlataforma, prestadorDe } from "@/lib/dominio/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aviso legal y privacidad" };

export default function Legal() {
  const texto = legalDePlataforma(prestadorDe(process.env), "Comanda");
  return (
    <PaginaCuenta titulo="Aviso legal y privacidad" ancho="max-w-2xl">
      <TextoLegalVista texto={texto} />
    </PaginaCuenta>
  );
}
