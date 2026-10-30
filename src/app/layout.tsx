import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { CapturarErrores } from "@/components/capturar-errores";

const texto = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-texto",
});
const rotulo = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--fuente-rotulo",
});

export const metadata: Metadata = {
  title: { default: "Comanda · TPV para bares", template: "%s · Comanda" },
  description:
    "Carta QR con pedidos, app de camarero, cocina, caja, gastos e impresión de tickets.",
};

export const viewport: Viewport = {
  themeColor: "#1d4fbf",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${rotulo.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <CapturarErrores />
        {children}
      </body>
    </html>
  );
}
