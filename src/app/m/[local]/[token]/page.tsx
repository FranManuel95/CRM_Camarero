import type { Metadata } from "next";
import { configDirecto, leerEstado } from "@/lib/servidor/almacen";
import { vistaCliente } from "@/lib/servidor/vistas";
import { CartaCliente } from "./carta-cliente";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ local: string; token: string }> };

async function cargar(local: string, token: string) {
  try {
    return vistaCliente(await leerEstado(local), token);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { local, token } = await params;
  const vista = await cargar(local, token);
  return { title: vista ? `Carta · ${vista.local.nombre}` : "Carta", robots: { index: false } };
}

export default async function PaginaCarta({ params }: Params) {
  const { local, token } = await params;
  const vista = await cargar(local, token);
  if (!vista)
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="mb-2 font-rotulo text-3xl font-bold">Este QR ya no vale</h1>
          <p className="text-tinta-suave">Pide al camarero el QR nuevo de tu mesa.</p>
        </div>
      </main>
    );
  return (
    <CartaCliente local={local} token={token} inicial={vista} directo={configDirecto(local)} />
  );
}
