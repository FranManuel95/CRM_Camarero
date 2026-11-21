import type { DatoContexto, EntradaAyuda, QuienPregunta } from "./tipos";

/** Minúsculas, sin tildes ni signos. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras que no ayudan a buscar. */
const VACIAS = new Set(
  "a al como con cual cuando de del donde el en es esta este hacer hago la las le lo los me mi mis o para por puedo que se si sin su sus te tengo un una uno y ya hay quiero oye".split(
    " ",
  ),
);

/** Palabras que significan lo mismo para el buscador. */
const SINONIMOS: Record<string, string> = {
  subir: "precio",
  bajar: "precio",
  caro: "precio",
  barato: "precio",
  cuesta: "precio",
  vale: "precio",
  rebaja: "descuento",
  oferta: "descuento",
  gratis: "invitar",
  invitacion: "invitar",
  regalar: "invitar",
  borrar: "quitar",
  eliminar: "quitar",
  cancelar: "anular",
  plato: "producto",
  bebida: "producto",
  articulo: "producto",
  productos: "producto",
  platos: "producto",
  camarero: "equipo",
  camareros: "equipo",
  empleado: "equipo",
  empleados: "equipo",
  trabajador: "equipo",
  personal: "equipo",
  pagar: "cobrar",
  pago: "cobrar",
  cuenta: "cuenta",
  ticket: "ticket",
  factura: "ticket",
  tarjeta: "cobrar",
  efectivo: "cobrar",
  cocina: "cocina",
  comanda: "mandar",
  enviar: "mandar",
  imprimir: "imprimir",
  impresora: "imprimir",
  impresion: "imprimir",
  papel: "imprimir",
  movil: "aparato",
  tablet: "aparato",
  telefono: "aparato",
  ordenador: "aparato",
  contrasena: "clave",
  password: "clave",
  pin: "pin",
  qr: "qr",
  horario: "hora",
  horas: "hora",
  turno: "turno",
  turnos: "turno",
  menu: "carta",
  cartas: "carta",
  dinero: "caja",
  cajon: "caja",
  arqueo: "cerrar",
  // Formas de los verbos que más se preguntan («¿cómo cierro…?», «¿dónde pongo…?»).
  cierro: "cerrar",
  cierra: "cerrar",
  cierre: "cerrar",
  cerramos: "cerrar",
  abro: "abrir",
  abre: "abrir",
  cobro: "cobrar",
  cobra: "cobrar",
  cobramos: "cobrar",
  subo: "precio",
  sube: "precio",
  bajo: "precio",
  pongo: "poner",
  pone: "poner",
  quito: "quitar",
  quita: "quitar",
  anulo: "anular",
  anula: "anular",
  invito: "invitar",
  mando: "mandar",
  manda: "mandar",
  imprimo: "imprimir",
  imprime: "imprimir",
  ficho: "fichar",
  vinculo: "vincular",
  devuelvo: "devolver",
  wifi: "conexion",
  internet: "conexion",
  red: "conexion",
};

/** Raíz sencilla: sin plural ni terminaciones verbales comunes, y con sinónimos. */
export function raiz(palabra: string): string {
  const p = SINONIMOS[palabra] ?? palabra;
  if (p.length <= 4) return p;
  return p.replace(/(ciones|cion|mente|ando|iendo|ados|adas|ado|ada|ar|er|ir|es|s)$/, "");
}

export function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p && !VACIAS.has(p))
    .map(raiz)
    .filter((p) => p.length >= 2);
}

type Indice = {
  entrada: EntradaAyuda;
  titulo: Set<string>;
  preguntas: Set<string>;
  resto: Set<string>;
};

const indices = new WeakMap<EntradaAyuda[], Indice[]>();

function indexar(entradas: EntradaAyuda[]): Indice[] {
  const ya = indices.get(entradas);
  if (ya) return ya;
  const hecho = entradas.map((entrada) => ({
    entrada,
    titulo: new Set(palabras(entrada.titulo)),
    preguntas: new Set(entrada.preguntas.flatMap(palabras)),
    resto: new Set([...entrada.pasos, entrada.nota ?? ""].flatMap(palabras)),
  }));
  indices.set(entradas, hecho);
  return hecho;
}

const coincide = (conjunto: Set<string>, p: string) => {
  if (conjunto.has(p)) return true;
  if (p.length < 4) return false;
  for (const x of conjunto) if (x.length >= 4 && (x.startsWith(p) || p.startsWith(x))) return true;
  return false;
};

export type Resultado = {
  entrada: EntradaAyuda;
  puntos: number;
  /** Si quien pregunta no puede hacerlo (o la función está apagada), por qué. */
  aviso?: string;
};

/** Por qué no lo puede hacer quien pregunta (o nada, si puede). */
export function avisoPara(entrada: EntradaAyuda, quien?: QuienPregunta): string | undefined {
  if (!quien) return undefined;
  if (entrada.quien === "encargado" && quien.rol !== "encargado")
    return "Esto lo hace el encargado.";
  if (entrada.permiso && !quien.puede(entrada.permiso))
    return "Ahora no tienes permiso para esto: pídeselo al encargado.";
  if (entrada.funcion && !quien.activa(entrada.funcion))
    return "Está apagado en este bar: se enciende en Gestión → Funciones.";
  return undefined;
}

/**
 * Busca en el manual. Cuenta más lo que coincide con el título y las formas de preguntarlo que
 * con los pasos. Lo que quien pregunta no puede hacer sale igual (para explicarle quién lo hace),
 * pero detrás.
 */
export function buscarAyuda(
  entradas: EntradaAyuda[],
  texto: string,
  quien?: QuienPregunta,
  cuantos = 6,
): Resultado[] {
  const buscadas = [...new Set(palabras(texto))];
  if (!buscadas.length) return [];
  const resultados: Resultado[] = [];
  for (const i of indexar(entradas)) {
    let puntos = 0;
    let encontradas = 0;
    for (const p of buscadas) {
      const pt = coincide(i.titulo, p)
        ? 3
        : coincide(i.preguntas, p)
          ? 2
          : coincide(i.resto, p)
            ? 1
            : 0;
      if (pt) encontradas++;
      puntos += pt;
    }
    if (!puntos) continue;
    // Premia que estén todas las palabras.
    puntos += (encontradas / buscadas.length) * 4;
    const aviso = avisoPara(i.entrada, quien);
    if (aviso) puntos -= 1.5;
    resultados.push({ entrada: i.entrada, puntos, aviso });
  }
  return resultados.sort((a, b) => b.puntos - a.puntos).slice(0, cuantos);
}

/** Los datos que pide la ruta de una entrada, en orden ({mesa} antes que {linea}). */
export function datosQuePide(ruta: string | undefined): DatoContexto[] {
  if (!ruta) return [];
  const orden: DatoContexto[] = ["mesa", "linea", "producto", "cliente"];
  return orden.filter((d) => ruta.includes(`{${d}}`));
}

/** La ruta con los datos puestos. Solo rutas de la propia app. */
export function rutaCon(ruta: string, datos: Partial<Record<DatoContexto, string>>): string {
  const hecha = ruta.replace(/\{(mesa|linea|producto|cliente)\}/g, (_, d: DatoContexto) =>
    encodeURIComponent(datos[d] ?? ""),
  );
  if (!hecha.startsWith("/") || hecha.startsWith("//")) throw new Error("Ruta no válida");
  return hecha;
}
