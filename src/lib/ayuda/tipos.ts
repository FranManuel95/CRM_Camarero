import type { Funcion } from "../dominio/funciones";
import type { Permiso } from "../dominio/tipos";

/**
 * Datos que una entrada puede pedir antes de llevar a su pantalla: «¿de qué mesa?», «¿qué
 * producto de la cuenta?»… Se eligen entre los datos del bar en ese momento.
 */
export type DatoContexto = "mesa" | "linea" | "producto" | "cliente";

/** Una pregunta del manual de la app, con su respuesta, su pantalla y quién puede hacerlo. */
export type EntradaAyuda = {
  id: string;
  /** Cómo se llama la tarea: «Cambiar el precio de un producto en una cuenta». */
  titulo: string;
  /** Otras formas de preguntarlo, para el buscador: «subir el precio al cobrar»… */
  preguntas: string[];
  /** Los pasos, con los nombres de los botones tal y como salen en la pantalla. */
  pasos: string[];
  /**
   * A dónde lleva «Llévame ahí». Puede pedir datos con {mesa}, {linea}, {producto} o {cliente}:
   * «/sala/{mesa}?abrir=precios&lineas={linea}».
   */
  ruta?: string;
  /** Quién puede hacerlo: cualquiera del equipo o solo el encargado. */
  quien: "equipo" | "encargado";
  /** Además, el permiso que hace falta (el encargado siempre lo tiene). */
  permiso?: Permiso;
  /** La función que tiene que estar encendida en Gestión → Funciones. */
  funcion?: Funcion;
  /** Acciones de la app que explica (para comprobar que no falta ninguna). */
  acciones?: string[];
  /** Pantallas que explica (rutas como en src/app, sin los grupos). */
  pantallas?: string[];
  /** Funciones del servidor (/api/…) que hay detrás de lo que explica. */
  apis?: string[];
  /** Funciones que explica (además de la que necesita). */
  funciones?: Funcion[];
  /** Un consejo o aviso que va después de los pasos. */
  nota?: string;
  /**
   * Para la captura de la ayuda (`npm run capturas`), si la de siempre no vale: otra pantalla y
   * el texto del botón o campo que se señala, y antes qué se toca (`clic`). Sin esto, se señala
   * lo primero de los pasos que se vea en la pantalla. La ruta puede llevar además {enviada}
   * (una mesa ya mandada a cocina) y {qr} (una mesa con un pedido del QR). `false`: sin
   * captura (pantallas que solo existen con la cuenta en la nube).
   */
  captura?: { ruta?: string; marca?: string; clic?: string } | false;
  /** Entradas relacionadas (por id). */
  ver?: string[];
};

/** Lo que el buscador necesita saber de quien pregunta. */
export type QuienPregunta = {
  rol: "camarero" | "encargado";
  puede: (p: Permiso) => boolean;
  activa: (f: Funcion) => boolean;
};
