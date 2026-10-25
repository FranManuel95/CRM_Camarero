import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Sirve las fotos guardadas en el ordenador del bar. */
export async function GET(_request: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(archivo)) return new Response("No encontrada", { status: 404 });
  const carpeta = path.join(process.env.DATOS_DIR ?? path.join(process.cwd(), "datos"), "fotos");
  try {
    return new Response(await readFile(path.join(carpeta, archivo)), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("No encontrada", { status: 404 });
  }
}
