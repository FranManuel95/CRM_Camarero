import type { Metadata } from "next";
import { Sala } from "./sala";

export const metadata: Metadata = { title: "Sala" };

export default function PaginaSala() {
  return <Sala />;
}
