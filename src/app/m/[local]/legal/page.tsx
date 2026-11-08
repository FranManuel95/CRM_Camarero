import type { Metadata } from "next";
import { activa } from "@/lib/dominio/funciones";
import { legalDelBar, prestadorDe } from "@/lib/dominio/legal";
import { leerEstado } from "@/lib/servidor/almacen";
import { servicios } from "@/lib/servidor/servicios";
import { TextoLegalVista } from "@/components/texto-legal";
import { CabeceraPublica } from "../publico";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aviso legal y privacidad", robots: { index: false } };

/** Aviso legal, privacidad y cookies de las páginas públicas del bar. */
export default async function LegalDelBar({ params }: { params: Promise<{ local: string }> }) {
  const { local } = await params;
  const estado = await leerEstado(local).catch(() => null);
  if (!estado) notFound();
  const texto = legalDelBar(
    estado.ajustes,
    (f) => activa(estado.ajustes, f),
    prestadorDe(process.env),
    servicios().correo,
  );
  return (
    <div className="min-h-dvh bg-white">
      <CabeceraPublica nombre={estado.ajustes.nombreLocal} titulo="Aviso legal y privacidad" />
      <main className="mx-auto max-w-2xl p-4 pb-12">
        <TextoLegalVista texto={texto} />
      </main>
    </div>
  );
}
