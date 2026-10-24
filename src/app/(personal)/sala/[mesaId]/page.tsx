import type { Metadata } from "next";
import { Comanda } from "./comanda";

export const metadata: Metadata = { title: "Mesa" };

export default async function PaginaMesa({ params }: { params: Promise<{ mesaId: string }> }) {
  const { mesaId } = await params;
  return <Comanda mesaId={mesaId} />;
}
