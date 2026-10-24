import type { Metadata } from "next";
import { EditorCarta } from "./editor-carta";

export const metadata: Metadata = { title: "Carta" };

export default function PaginaCarta() {
  return <EditorCarta />;
}
