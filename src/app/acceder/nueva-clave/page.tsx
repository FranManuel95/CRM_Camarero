import type { Metadata } from "next";
import { PaginaCuenta } from "@/components/pagina-cuenta";
import { NuevaClave } from "./nueva-clave";

export const metadata: Metadata = { title: "Otra contraseña" };

export default function PaginaNuevaClave() {
  return (
    <PaginaCuenta titulo="Pon tu contraseña nueva">
      <NuevaClave />
    </PaginaCuenta>
  );
}
