import { activa, type Funcion } from "@/lib/dominio/funciones";
import { leerEstado } from "@/lib/servidor/almacen";

/** El nombre del bar si tiene encendidas estas funciones (si no, null: la página no existe). */
export async function barConFunciones(local: string, funciones: Funcion[]) {
  try {
    const { ajustes } = await leerEstado(local);
    return funciones.every((f) => activa(ajustes, f))
      ? { nombre: ajustes.nombreLocal, telefono: ajustes.telefono }
      : null;
  } catch {
    return null;
  }
}

/** Cabecera de las páginas públicas del bar (encargar, reservar). */
export function CabeceraPublica({ nombre, titulo }: { nombre: string; titulo: string }) {
  return (
    <header className="azulejo">
      <div className="bg-gradient-to-b from-transparent to-cobalto-oscuro/80 px-4 pt-10 pb-5 text-white">
        <p className="text-sm font-semibold opacity-90">{titulo}</p>
        <h1 className="font-rotulo text-5xl leading-none font-bold drop-shadow">{nombre}</h1>
      </div>
    </header>
  );
}

export function NoDisponible({ que }: { que: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-rotulo text-3xl font-bold">Ahora no se puede {que}</h1>
        <p className="text-tinta-suave">Este bar no lo tiene activado. Llama por teléfono.</p>
      </div>
    </main>
  );
}
