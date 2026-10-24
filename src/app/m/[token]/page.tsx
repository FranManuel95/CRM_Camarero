import type { Metadata } from "next";
import { leerEstado } from "@/lib/servidor/almacen";
import { vistaCliente } from "@/lib/servidor/vistas";
import { CartaCliente } from "./carta-cliente";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const vista = vistaCliente(leerEstado(), (await params).token);
  return { title: vista ? `Carta · ${vista.mesa.nombre}` : "Carta", robots: { index: false } };
}

export default async function PaginaCarta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vista = vistaCliente(leerEstado(), token);
  if (!vista)
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="mb-2 font-rotulo text-3xl font-bold">Este QR ya no vale</h1>
          <p className="text-tinta-suave">Pide al camarero el QR nuevo de tu mesa.</p>
        </div>
      </main>
    );
  return <CartaCliente token={token} inicial={vista} />;
}
