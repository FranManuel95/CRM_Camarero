import { AJUSTES } from "./entradas/ajustes";
import { CAJA_COCINA } from "./entradas/caja-cocina";
import { CARTA } from "./entradas/carta";
import { CUENTA } from "./entradas/cuenta";
import { GESTION } from "./entradas/gestion";
import { SALA } from "./entradas/sala";
import type { EntradaAyuda } from "./tipos";

/** El manual de la app: una entrada por tarea. `tests/unit/ayuda.test.ts` comprueba que cubre todo. */
export const MANUAL: EntradaAyuda[] = [
  ...SALA,
  ...CAJA_COCINA,
  ...CARTA,
  ...GESTION,
  ...AJUSTES,
  ...CUENTA,
];

export const entradaPorId = (id: string) => MANUAL.find((e) => e.id === id);

export { avisoPara, buscarAyuda, datosQuePide, rutaCon } from "./buscar";
export type { DatoContexto, EntradaAyuda, QuienPregunta } from "./tipos";
