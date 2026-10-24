import type { Metadata } from "next";
import { EditorMesas } from "./editor-mesas";

export const metadata: Metadata = { title: "Mesas y QR" };

export default function PaginaMesas() {
  return <EditorMesas />;
}
