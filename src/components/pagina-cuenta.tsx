import Link from "next/link";

/** Marco de las páginas de la cuenta del dueño (fuera del TPV). */
export function PaginaCuenta({
  titulo,
  children,
  ancho = "max-w-md",
}: {
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  return (
    <div className="min-h-dvh bg-zinc-claro">
      <header className="azulejo">
        <div className="bg-cobalto-oscuro/85 px-4 py-4">
          <Link href="/" className="font-rotulo text-3xl font-bold text-white">
            Comanda
          </Link>
        </div>
      </header>
      <main className={`mx-auto px-4 py-10 ${ancho}`}>
        <h1 className="mb-6 font-rotulo text-4xl font-bold">{titulo}</h1>
        {children}
      </main>
    </div>
  );
}
