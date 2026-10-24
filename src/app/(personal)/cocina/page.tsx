import type { Metadata } from "next";
import { Cocina } from "./cocina";

export const metadata: Metadata = { title: "Cocina y barra" };

export default async function PaginaCocina({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;
  return (
    <Cocina destino={destino === "barra" ? "barra" : destino === "todo" ? "todo" : "cocina"} />
  );
}
