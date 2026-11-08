import {
  declaracionEnTexto,
  declaracionResponsable,
  productorDe,
  SISTEMA,
} from "@/lib/dominio/declaracion";
import { enLaNube } from "@/lib/servidor/almacen";

export const dynamic = "force-dynamic";

/** La declaración responsable en texto, para dársela al bar al contratar (art. 15.3). */
export function GET() {
  const texto = declaracionEnTexto(declaracionResponsable(productorDe(process.env), enLaNube()));
  return new Response(texto, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="declaracion-responsable-${SISTEMA.nombre.toLowerCase()}-${SISTEMA.version}.txt"`,
    },
  });
}
