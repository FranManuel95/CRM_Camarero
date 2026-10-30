import type { NextConfig } from "next";

/** La base de datos en la nube (datos en directo y fotos), si la hay. */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : null;

/**
 * Qué puede cargar la app. Los scripts propios de Next van en línea ('unsafe-inline'); lo que
 * se bloquea es cargar código o conectarse a otros sitios, y que otra web meta la app en un
 * marco para engañar al usuario.
 */
const politica = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabase ? ` https://${supabase}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` https://${supabase} wss://${supabase}` : ""}`,
  "worker-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const cabeceras = [
  { key: "Content-Security-Policy", value: politica },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Cámara solo para fotos de la carta y facturas; nada de micrófono, ubicación ni pagos.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // En desarrollo Next necesita evaluar código: la política solo va en producción.
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default config;
