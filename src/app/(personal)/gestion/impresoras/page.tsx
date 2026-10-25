import type { Metadata } from "next";
import { clavePuente, enLaNube } from "@/lib/servidor/almacen";
import { sesionActual } from "@/lib/servidor/sesion";
import { Impresoras } from "./impresoras";

export const metadata: Metadata = { title: "Impresoras" };

export default async function PaginaImpresoras() {
  const sesion = await sesionActual();
  // En la nube, las impresoras de red las atiende el puente que corre en el bar.
  const puente = enLaNube() && sesion ? { clave: clavePuente(sesion.local) } : null;
  return <Impresoras puente={puente} />;
}
