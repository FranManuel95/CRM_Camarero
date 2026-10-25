import { SubmenuEquipo } from "./submenu";

export default function LayoutEquipo({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <h1 className="mb-3 font-rotulo text-4xl font-bold">Equipo</h1>
      <SubmenuEquipo />
      {children}
    </main>
  );
}
