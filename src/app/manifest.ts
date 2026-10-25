import type { MetadataRoute } from "next";

/** Para instalar la app en el móvil o la tablet, a pantalla completa y abriendo en la sala. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comanda · TPV del bar",
    short_name: "Comanda",
    description: "Sala, cocina, caja y carta QR del bar.",
    lang: "es",
    start_url: "/sala",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#13212e",
    theme_color: "#13212e",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
