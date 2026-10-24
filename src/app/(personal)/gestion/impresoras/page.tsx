import type { Metadata } from "next";
import { almacen, clavePuente } from "@/lib/servidor/almacen";
import { Impresoras } from "./impresoras";

export const metadata: Metadata = { title: "Impresoras" };

export default function PaginaImpresoras() {
  // En la nube, las impresoras de red las atiende el puente que corre en el bar.
  const puente = almacen().modo === "supabase" ? { clave: clavePuente() } : null;
  return <Impresoras puente={puente} />;
}
