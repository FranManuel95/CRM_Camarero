import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-rotulo text-4xl font-bold">Aquí no hay nada</h1>
        <Link href="/" className="font-semibold text-cobalto underline">
          Ir a la portada
        </Link>
      </div>
    </main>
  );
}
