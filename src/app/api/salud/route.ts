import { enLaNube, leerEstado, localDemo } from "@/lib/servidor/almacen";
import { registrar } from "@/lib/servidor/registro";

export const dynamic = "force-dynamic";

/**
 * Para un vigilante externo (UptimeRobot, Better Stack…): ¿responde la app y llega a la base de
 * datos? No devuelve datos de ningún bar.
 */
export async function GET() {
  const inicio = performance.now();
  try {
    await leerEstado(localDemo());
    return Response.json(
      {
        ok: true,
        modo: enLaNube() ? "nube" : "archivo",
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        ms: Math.round(performance.now() - inicio),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    registrar("error", "salud_ko", { mensaje: e instanceof Error ? e.message : String(e) });
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
