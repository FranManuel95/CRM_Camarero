import { redirect } from "next/navigation";
import { localDemo } from "@/lib/servidor/almacen";

/** Los QR antiguos (sin el bar en la dirección) eran del bar de demostración. */
export default async function QrAntiguo({ params }: { params: Promise<{ local: string }> }) {
  redirect(`/m/${localDemo()}/${(await params).local}`);
}
