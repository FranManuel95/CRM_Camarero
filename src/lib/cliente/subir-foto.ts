"use client";

/** Reduce la foto en el propio aparato (máx. 1000 px, WebP) para que la carta cargue rápido. */
async function reducir(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1000 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((ok, mal) =>
    lienzo.toBlob(
      (b) => (b ? ok(b) : mal(new Error("No se ha podido preparar la foto."))),
      "image/webp",
      0.82,
    ),
  );
}

/** Sube la foto de un plato y devuelve su dirección pública. */
export async function subirFoto(archivo: File, clavePublica: string): Promise<string> {
  const foto = await reducir(archivo);
  const enNube = Boolean(clavePublica);
  const r = await fetch("/api/fotos", {
    method: "POST",
    // En el ordenador del bar la foto va en la misma petición.
    body: enNube ? undefined : foto,
  });
  const datos = (await r.json()) as { subir?: string; publica?: string; error?: string };
  if (!r.ok || !datos.publica) throw new Error(datos.error ?? "No se ha podido subir la foto.");
  if (enNube && datos.subir) {
    const subida = await fetch(datos.subir, {
      method: "POST",
      headers: { apikey: clavePublica, "Content-Type": "image/webp" },
      body: foto,
    });
    if (!subida.ok) throw new Error("No se ha podido subir la foto. Prueba otra vez.");
  }
  return datos.publica;
}
