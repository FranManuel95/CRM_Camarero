import type { Ajustes } from "./tipos";

/**
 * Funciones que cada bar puede encender o apagar desde Gestión → Funciones. Apagada, una función
 * desaparece de las pantallas y sus acciones se rechazan; los datos que ya tenía se guardan y
 * vuelven al encenderla. Algunas necesitan además una clave en el servidor (`necesita`): sin
 * ella no se pueden encender.
 */
export const FUNCIONES = {
  ventaRapida: {
    grupo: "Servicio",
    nombre: "Venta rápida",
    descripcion: "Cobrar en barra o para llevar sin abrir mesa.",
    defecto: true,
  },
  paraDespues: {
    grupo: "Servicio",
    nombre: "Para después y marcha",
    descripcion: "Anotar platos que cocina prepara cuando el camarero da la marcha.",
    defecto: true,
  },
  cobrarPorPartes: {
    grupo: "Servicio",
    nombre: "Cobrar por platos",
    descripcion: "Que cada uno pague lo suyo dentro de la misma mesa.",
    defecto: true,
  },
  propinas: {
    grupo: "Servicio",
    nombre: "Propinas",
    descripcion: "Apuntar la propina al cobrar; sale en el cierre y en los informes.",
    defecto: true,
  },
  paraLlevar: {
    grupo: "Servicio",
    nombre: "Pedidos para llevar",
    descripcion: "Apuntar encargos con nombre y hora de recogida; cocina los ve aparte.",
    defecto: true,
  },
  cartaIngles: {
    grupo: "Carta QR",
    nombre: "Carta en inglés",
    descripcion: "Botón «English» en la carta del cliente.",
    defecto: true,
  },
  reservas: {
    grupo: "Clientes",
    nombre: "Reservas",
    descripcion: "Libro de reservas del día; la mesa reservada se ve en la sala antes de la hora.",
    defecto: true,
  },
  reservasOnline: {
    grupo: "Clientes",
    nombre: "Reservar desde la web",
    descripcion: "Un enlace para que los clientes pidan mesa; el bar la confirma por teléfono.",
    defecto: false,
  },
  pedidosOnline: {
    grupo: "Clientes",
    nombre: "Encargar para llevar desde el móvil",
    descripcion:
      "Un enlace para pedir con la carta y recoger a una hora; cocina lo ve al aceptarlo.",
    defecto: false,
  },
  club: {
    grupo: "Clientes",
    nombre: "Club de clientes",
    descripcion:
      "Los clientes se apuntan desde el QR o en la caja, suman puntos al pagar y los canjean por descuentos. Ficha con sus visitas y lo que más piden.",
    defecto: false,
  },
  fiado: {
    grupo: "Clientes",
    nombre: "Cuentas a deber (fiado)",
    descripcion:
      "Dejar a deber la cuenta de un cliente del club y cobrársela otro día. Su ficha dice cuánto debe.",
    defecto: false,
  },
  resenas: {
    grupo: "Clientes",
    nombre: "Pedir una reseña",
    descripcion:
      "Al cobrar, un QR que lleva directo a poner las estrellas en Google; también en la carta, el ticket y carteles (Gestión → Reseñas).",
    defecto: false,
  },
  ticketCorreo: {
    grupo: "Clientes",
    nombre: "Ticket por correo",
    descripcion: "Mandar el ticket al correo del cliente, desde la caja o desde su móvil.",
    defecto: true,
    necesita: "correo",
  },
  verifactu: {
    grupo: "Hacienda",
    nombre: "VERI*FACTU",
    descripcion:
      "Cada ticket se manda a la AEAT al momento y lleva el QR para que el cliente lo compruebe.",
    defecto: false,
    necesita: "aeat",
  },
  stock: {
    grupo: "Stock",
    nombre: "Stock y escandallos",
    descripcion: "Existencias, descuento al vender, agotado automático y lista de la compra.",
    defecto: true,
  },
  facturasConFoto: {
    grupo: "Stock",
    nombre: "Leer facturas con una foto",
    descripcion: "Rellena el pedido recibido leyendo la factura del proveedor.",
    defecto: true,
    necesita: "ia",
  },
  fichajes: {
    grupo: "Equipo",
    nombre: "Fichajes",
    descripcion: "Registro de jornada con el PIN (entrada, descansos y salida).",
    defecto: true,
  },
  cuadrante: {
    grupo: "Equipo",
    nombre: "Cuadrante de turnos",
    descripcion: "Turnos de la semana por persona, para imprimir y comparar con lo fichado.",
    defecto: true,
  },
  sinConexion: {
    grupo: "Aparatos",
    nombre: "Seguir sin wifi",
    descripcion:
      "Si se corta la red, el móvil sigue abriendo mesas, anotando y mandando; lo envía todo al volver.",
    defecto: true,
  },
  appInstalable: {
    grupo: "Aparatos",
    nombre: "App instalable",
    descripcion:
      "Instalar Comanda en el móvil o la tablet, a pantalla completa, y que abra aunque la red vaya mal.",
    defecto: true,
  },
  copias: {
    grupo: "Seguridad",
    nombre: "Copias de seguridad",
    descripcion:
      "Descargar una copia completa (tickets, carta, equipo…). En el ordenador del bar, además, una copia diaria automática.",
    defecto: true,
  },
  historial: {
    grupo: "Seguridad",
    nombre: "Historial de cambios",
    descripcion: "Quién anuló, descontó, rectificó o cambió la carta o la caja, y cuándo.",
    defecto: true,
  },
} as const satisfies Record<string, DefinicionFuncion>;

/** Servicios del servidor que algunas funciones necesitan (una clave o un certificado). */
export type Servicio = "ia" | "correo" | "aeat";

export type DefinicionFuncion = {
  grupo: string;
  nombre: string;
  descripcion: string;
  defecto: boolean;
  necesita?: Servicio;
};

export type Funcion = keyof typeof FUNCIONES;

export const LISTA_FUNCIONES = Object.keys(FUNCIONES) as Funcion[];

/** Lo que dice el servidor que tiene configurado (true = hay clave). */
export type Servicios = Record<Servicio, boolean>;

/** ¿Está encendida? (sin mirar si el servidor tiene la clave que hace falta). */
export function activa(ajustes: Pick<Ajustes, "funciones">, funcion: Funcion): boolean {
  return ajustes.funciones?.[funcion] ?? FUNCIONES[funcion].defecto;
}

/** ¿Se puede usar? Encendida y, si necesita algo del servidor, que esté configurado. */
export function disponible(
  ajustes: Pick<Ajustes, "funciones">,
  servicios: Partial<Servicios>,
  funcion: Funcion,
): boolean {
  const def: DefinicionFuncion = FUNCIONES[funcion];
  return activa(ajustes, funcion) && (!def.necesita || Boolean(servicios[def.necesita]));
}
