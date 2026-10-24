import type { Metadata } from "next";
import { HojaQR } from "./hoja-qr";

export const metadata: Metadata = { title: "QR de las mesas" };

export default function PaginaQR() {
  return <HojaQR urlPublica={process.env.URL_PUBLICA ?? ""} />;
}
