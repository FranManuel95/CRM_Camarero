import type { Bloque } from "../impresion/documento";

/**
 * Modelo de datos del local. Todo el estado vive en un único objeto `Estado` que el servidor
 * guarda y reparte a las pantallas; los cambios entran como `Accion` (ver acciones.ts) y los
 * aplica `reducir` (ver reducir.ts). Los importes van siempre en céntimos y con IVA incluido,
 * que es como se ponen los precios en una carta en España.
 */

export type Id = string;
/** Céntimos de euro. */
export type Centimos = number;
/** Fecha ISO 8601 (UTC). */
export type FechaISO = string;

export type Rol = "camarero" | "encargado";

export type Empleado = {
  id: Id;
  nombre: string;
  /** PIN de 4 a 6 cifras para entrar en la app. */
  pin: string;
  rol: Rol;
  activo: boolean;
};

export type Ajustes = {
  nombreLocal: string;
  razonSocial: string;
  nif: string;
  direccion: string;
  telefono: string;
  /** IVA por defecto de la carta, en %. La hostelería en España va al 10 %. */
  ivaPorDefecto: number;
  /** Si es true, los pedidos de la carta QR esperan a que un camarero los acepte. */
  confirmarPedidosQR: boolean;
  /** Si es false, la carta QR solo se puede consultar (sin pedir). */
  pedidosQRActivos: boolean;
  /** Texto al pie del ticket. */
  pieTicket: string;
  /** Serie de los tickets (facturas simplificadas). */
  serieTicket: string;
  /** Funciones encendidas o apagadas (ver funciones.ts). Lo que no está, va por defecto. */
  funciones?: Partial<Record<string, boolean>>;
  /** Dónde dejar una reseña (Google, TripAdvisor…). Sale al pagar si «Reseñas» está encendido. */
  enlaceResena?: string;
};

export type Zona = { id: Id; nombre: string; orden: number };

export type FormaMesa = "cuadrada" | "redonda" | "alargada";

export type Mesa = {
  id: Id;
  nombre: string;
  zonaId: Id;
  /** Posición y tamaño en el plano, en unidades de una rejilla de 100 × 100. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  forma: FormaMesa;
  plazas: number;
  /** Código del QR de la mesa. Se puede regenerar si alguien se lleva la foto del QR. */
  token: string;
};

/** A qué pantalla e impresora va un plato. */
export type Destino = "cocina" | "barra";

/** Franja en la que se sirve una categoría (hora de Madrid). */
export type Horario = {
  /** «08:00». */
  desde: string;
  /** «12:30». Si es menor que `desde`, la franja cruza la medianoche. */
  hasta: string;
  /** Días de la semana: 0 domingo … 6 sábado. Vacío = todos. */
  dias: number[];
};

export type Categoria = {
  id: Id;
  nombre: string;
  /** Nombre en inglés para la carta QR (opcional). */
  nombreEn?: string;
  /** Si tiene horario, en la carta QR solo sale (y solo se puede pedir) dentro de él. */
  horario?: Horario;
  orden: number;
  destino: Destino;
  /** Si es false, no se enseña en la carta QR (pero sí en la app del camarero). */
  visibleEnQR: boolean;
};

/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). */
export const ALERGENOS = [
  "gluten",
  "crustaceos",
  "huevo",
  "pescado",
  "cacahuetes",
  "soja",
  "lacteos",
  "frutos_cascara",
  "apio",
  "mostaza",
  "sesamo",
  "sulfitos",
  "altramuces",
  "moluscos",
] as const;
export type Alergeno = (typeof ALERGENOS)[number];

export const NOMBRE_ALERGENO: Record<Alergeno, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevo: "Huevo",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Lácteos",
  frutos_cascara: "Frutos de cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export type OpcionProducto = {
  id: Id;
  nombre: string;
  nombreEn?: string;
  suplemento: Centimos;
  /**
   * Si esta opción la prepara otro sitio que el plato (la bebida de un menú del día va a barra
   * aunque el menú sea de cocina).
   */
  destino?: Destino;
};

export type GrupoOpciones = {
  id: Id;
  /** Por ejemplo «Punto de la carne» o «Extras». */
  nombre: string;
  nombreEn?: string;
  /** Hay que elegir al menos una. */
  obligatorio: boolean;
  /** Se puede elegir más de una. */
  multiple: boolean;
  opciones: OpcionProducto[];
};

/** Cuánto de un ingrediente lleva una ración (en la unidad del ingrediente). */
export type LineaReceta = { ingredienteId: Id; cantidad: number };

export type Producto = {
  id: Id;
  categoriaId: Id;
  nombre: string;
  descripcion: string;
  nombreEn?: string;
  descripcionEn?: string;
  /** Dirección pública de la foto del plato. */
  foto?: string;
  precio: Centimos;
  /** IVA en %, incluido en el precio. */
  iva: number;
  alergenos: Alergeno[];
  /** false = agotado hoy. Sigue en la carta pero no se puede pedir. */
  disponible: boolean;
  orden: number;
  grupos: GrupoOpciones[];
  /** Coste aproximado de la ración, para calcular el margen (si no tiene escandallo). */
  coste?: Centimos;
  /** Escandallo: lo que gasta cada ración. Al mandarla a cocina se descuenta del stock. */
  receta?: LineaReceta[];
  /** Lo puso agotado el stock (no una persona): vuelve solo cuando entra género. */
  agotadoPorStock?: boolean;
};

export type EstadoLinea =
  /** Pedida desde el QR y pendiente de que un camarero la acepte. */
  | "por_confirmar"
  /** En la comanda, aún sin mandar a cocina o barra. */
  | "anotada"
  /** Mandada como «para después»: cocina la ve, pero no la prepara hasta que el camarero diga «marcha». */
  | "en_espera"
  /** Mandada a cocina o barra. */
  | "enviada"
  | "lista"
  | "servida"
  | "anulada";

export type OrigenLinea = "qr" | "camarero";

export type OpcionElegida = {
  grupo: string;
  nombre: string;
  suplemento: Centimos;
  /** Si la prepara otro sitio que el plato (ver OpcionProducto.destino). */
  destino?: Destino;
};

export type LineaCuenta = {
  id: Id;
  productoId: Id;
  /** Copia del nombre y el precio al pedir: si luego cambia la carta, la cuenta no cambia. */
  nombre: string;
  precioUnitario: Centimos;
  iva: number;
  destino: Destino;
  cantidad: number;
  opciones: OpcionElegida[];
  nota: string;
  estado: EstadoLinea;
  origen: OrigenLinea;
  /** Quién la anotó (vacío si llegó por QR y aún no la ha aceptado nadie). */
  empleadoId: Id | null;
  creadaEn: FechaISO;
  enviadaEn: FechaISO | null;
  listaEn: FechaISO | null;
  /** Cada envío a cocina es una ronda; sirve para agrupar en la pantalla de cocina. */
  ronda: number;
  /** Si es una invitación de la casa, no se cobra. */
  invitacion: boolean;
  /** Anotada como «para después»: al mandar, queda en espera hasta la marcha. */
  despues?: boolean;
  /** Ya se descontó del stock (al mandarla). Si se anula, se devuelve. */
  descontado?: boolean;
  /** Ticket con el que se pagó (cuando se cobra la cuenta por partes). */
  ticketId?: Id;
  motivoAnulacion?: string;
};

export type MetodoPago = "efectivo" | "tarjeta" | "bizum" | "otro";

export type Pago = {
  metodo: MetodoPago;
  importe: Centimos;
  /** En los pagos con tarjeta desde el QR, la referencia del cobro en la pasarela. */
  referencia?: string;
};

export type EstadoCuenta = "abierta" | "cobrada" | "anulada";

/**
 * Datos de un pedido para llevar. Su cuenta no tiene mesa de verdad: `mesaId` es
 * «llevar-…» (ver selectores.ts), así que cada pedido es como una mesa más.
 */
export type DatosLlevar = {
  nombre: string;
  telefono: string;
  /** Hora de recogida, «14:30» (hora de Madrid). */
  recogida: string;
  /** Lo ha hecho el cliente desde su móvil (no el camarero). */
  online: boolean;
  /** Código del enlace con el que el cliente sigue su pedido (solo en los online). */
  token?: string;
};

export type Cuenta = {
  id: Id;
  mesaId: Id;
  /** Solo en los pedidos para llevar. */
  llevar?: DatosLlevar;
  estado: EstadoCuenta;
  comensales: number;
  abiertaEn: FechaISO;
  cerradaEn: FechaISO | null;
  /** Camarero que lleva la mesa. */
  empleadoId: Id | null;
  lineas: LineaCuenta[];
  /** Descuento sobre el total, en %. */
  descuento: number;
  rondas: number;
  ticketId: Id | null;
};

export type LineaTicket = {
  /** Nombre como sale en el ticket, con las opciones elegidas. */
  nombre: string;
  /** Nombre del plato tal cual está en la carta, para los informes. */
  producto: string;
  cantidad: number;
  precioUnitario: Centimos;
  importe: Centimos;
  iva: number;
};

export type DesgloseIva = { tipo: number; base: Centimos; cuota: Centimos; total: Centimos };

/**
 * Factura simplificada (lo que en un bar se llama «ticket»). Es inmutable: para corregirla se
 * hace una rectificativa, nunca se edita.
 */
export type Ticket = {
  id: Id;
  /** Serie + número correlativo, por ejemplo «T2026-000123». */
  numero: string;
  serie: string;
  secuencia: number;
  fecha: FechaISO;
  cuentaId: Id;
  mesaNombre: string;
  empleadoId: Id | null;
  lineas: LineaTicket[];
  descuento: number;
  desglose: DesgloseIva[];
  total: Centimos;
  pagos: Pago[];
  /** Cambio devuelto en efectivo. */
  cambio: Centimos;
  /** Propina que deja el cliente. No forma parte de la factura (ni lleva IVA). */
  propina?: Centimos;
  /** Huella encadenada con la del ticket anterior (ver huella.ts). */
  huella: string;
  huellaAnterior: string;
  /** Si es rectificativa, el ticket al que anula. */
  rectificaA: Id | null;
  /** F2 (factura simplificada) o R5 (su rectificativa). Los tickets antiguos no lo tienen. */
  tipoFactura?: "F2" | "R5";
  /** Fecha, hora y huso con que se calculó la huella («2026-10-24T21:05:09+02:00»). */
  generadoEn?: string;
  /** Con VERI*FACTU: la dirección de cotejo de la AEAT que va en el QR del ticket. */
  urlQr?: string;
};

export type CategoriaGasto =
  "proveedores" | "personal" | "alquiler" | "suministros" | "mantenimiento" | "impuestos" | "otros";

export const NOMBRE_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  proveedores: "Proveedores y género",
  personal: "Personal",
  alquiler: "Alquiler",
  suministros: "Luz, agua y gas",
  mantenimiento: "Mantenimiento",
  impuestos: "Impuestos y tasas",
  otros: "Otros",
};

export type Gasto = {
  id: Id;
  fecha: FechaISO;
  concepto: string;
  categoria: CategoriaGasto;
  proveedor: string;
  /** Importe total pagado, con IVA. */
  importe: Centimos;
  /** IVA soportado en %, para el resumen trimestral. */
  iva: number;
  metodo: MetodoPago;
  /** Si se pagó con dinero de la caja, sale como retirada en el arqueo. */
  deCaja: boolean;
  empleadoId: Id | null;
};

export type Unidad = "kg" | "l" | "ud";

export const NOMBRE_UNIDAD: Record<Unidad, string> = { kg: "kg", l: "litros", ud: "unidades" };

/** Lo que se compra y se gasta: patatas, cerveza de barril, huevos… */
export type Ingrediente = {
  id: Id;
  nombre: string;
  unidad: Unidad;
  /** Lo que queda (puede ser negativo si se vendió más de lo que había apuntado). */
  existencias: number;
  /** Por debajo de esto sale el aviso y entra en la lista de la compra. */
  minimo: number;
  /** Hasta cuánto se pide al hacer la compra. Si no hay, el doble del mínimo. */
  pedirHasta?: number;
  /** Último precio de compra por unidad (kg, litro o unidad), con IVA. */
  coste: Centimos;
  proveedor: string;
};

export type TipoMovimientoStock = "compra" | "recuento" | "merma";

/** Entradas y ajustes del almacén (lo que se gasta al vender no se apunta uno a uno). */
export type MovimientoStock = {
  id: Id;
  fecha: FechaISO;
  ingredienteId: Id;
  tipo: TipoMovimientoStock;
  /** Lo que sumó o restó. */
  cantidad: number;
  nota: string;
  empleadoId: Id | null;
  /** En las compras, el gasto que se apuntó. */
  gastoId?: Id;
};

/** Lo que había en un fichaje antes de que el encargado lo corrigiera. */
export type DatosFichaje = Pick<Fichaje, "entrada" | "salida" | "pausas">;

/**
 * Registro de jornada (art. 34.9 del Estatuto de los Trabajadores): hora de entrada y de salida
 * de cada día, con los descansos. Se guarda cuatro años. No se borra: si hay que corregirlo, el
 * encargado lo cambia y queda apuntado quién, cuándo, por qué y qué había antes.
 */
export type Fichaje = {
  id: Id;
  empleadoId: Id;
  entrada: FechaISO;
  /** null mientras la persona sigue trabajando (o si se le olvidó fichar la salida). */
  salida: FechaISO | null;
  pausas: { inicio: FechaISO; fin: FechaISO | null }[];
  cambios?: { en: FechaISO; por: Id; motivo: string; antes: DatosFichaje | null }[];
};

/** Un turno previsto en el cuadrante de la semana (hora de Madrid). */
export type TurnoCuadrante = {
  id: Id;
  empleadoId: Id;
  /** «2026-10-27». */
  dia: string;
  /** «12:00». */
  desde: string;
  /** «16:30». Si es menor que `desde`, el turno acaba al día siguiente. */
  hasta: string;
  /** Sala, barra, cocina… (texto libre, opcional). */
  puesto: string;
};

/** Anulaciones e invitaciones, para el informe por camarero (las cuentas cerradas se olvidan). */
export type Incidencia = {
  id: Id;
  fecha: FechaISO;
  tipo: "anulacion" | "invitacion";
  lineaId: Id;
  /** Quién la anuló o invitó. */
  empleadoId: Id;
  /** Quién la había anotado. */
  anotadaPor: Id | null;
  producto: string;
  cantidad: number;
  importe: Centimos;
  motivo: string;
};

/** Una línea del historial de cambios (ver historial.ts). */
export type EntradaHistorial = {
  id: Id;
  fecha: FechaISO;
  empleadoId: Id;
  /** Tipo de acción («anular_linea»…), para filtrar. */
  tipo: string;
  texto: string;
};

export type EstadoReserva =
  /** Pedida desde la web: falta que el bar la confirme. */
  | "por_confirmar"
  | "confirmada"
  /** Ya han llegado y están en su mesa. */
  | "sentada"
  | "cancelada"
  | "no_vino";

export type Reserva = {
  id: Id;
  nombre: string;
  telefono: string;
  personas: number;
  /** «2026-10-27» y «21:30», hora de Madrid. */
  dia: string;
  hora: string;
  /** Mesa asignada (puede no tener todavía). */
  mesaId: Id | null;
  nota: string;
  estado: EstadoReserva;
  /** Pedida desde la web del bar (si no, la apuntó alguien del equipo). */
  online: boolean;
  creadaEn: FechaISO;
};

/** Un pago con tarjeta desde el QR, tal como lo avisa la pasarela (se guarda para no repetirlo). */
export type PagoOnline = {
  referencia: string;
  fecha: FechaISO;
  cuentaId: Id;
  importe: Centimos;
  /** «cobrado»: se hizo el ticket solo. «a_mano»: la cuenta cambió y hay que cobrarlo a mano. */
  resultado: "cobrado" | "a_mano";
  ticketId?: Id;
};

/** Cómo ha ido el envío a la AEAT de un registro de facturación. */
export type EstadoRegistroAeat = "pendiente" | "correcto" | "aceptado_con_errores" | "incorrecto";

/**
 * Registro de facturación de VERI*FACTU (alta de un ticket), con lo necesario para mandarlo a la
 * AEAT aunque el ticket ya no esté en el estado (en la nube, los tickets viejos están aparte).
 */
export type RegistroAeat = {
  ticketId: Id;
  numero: string;
  /** «24-10-2026». */
  fechaExpedicion: string;
  tipoFactura: "F2" | "R5";
  desglose: DesgloseIva[];
  cuotaTotal: Centimos;
  importeTotal: Centimos;
  huella: string;
  generadoEn: string;
  /** El registro anterior de la cadena (null si es el primero). */
  anterior: { numero: string; fechaExpedicion: string; huella: string } | null;
  /** En las rectificativas, el ticket que rectifican. */
  rectifica?: { numero: string; fechaExpedicion: string };
  estado: EstadoRegistroAeat;
  /** Lo que ha dicho la AEAT si hay errores. */
  error?: string;
  /** Código seguro de verificación del envío en el que se aceptó. */
  csv?: string;
  enviadoEn?: FechaISO;
};

export type MovimientoCaja = {
  id: Id;
  fecha: FechaISO;
  tipo: "entrada" | "salida";
  importe: Centimos;
  motivo: string;
  empleadoId: Id | null;
};

/** Un turno de caja: de la apertura con el fondo al cierre con el arqueo (informe Z). */
export type TurnoCaja = {
  id: Id;
  numero: number;
  abiertoEn: FechaISO;
  cerradoEn: FechaISO | null;
  fondoInicial: Centimos;
  movimientos: MovimientoCaja[];
  /** Efectivo contado al cerrar. */
  efectivoContado: Centimos | null;
  abiertoPor: Id | null;
  cerradoPor: Id | null;
};

export type TipoAviso = "llamar" | "cuenta" | "pedido_qr" | "listo";

export type Aviso = {
  id: Id;
  mesaId: Id;
  tipo: TipoAviso;
  creadoEn: FechaISO;
  atendido: boolean;
  /** Detalle, por ejemplo «Pagará con tarjeta» o «Croquetas listas». */
  detalle: string;
};

export type ConexionImpresora = "red" | "navegador";

export type Impresora = {
  id: Id;
  nombre: string;
  conexion: ConexionImpresora;
  /** IP de la impresora térmica en la red del local (puerto 9100, estándar ESC/POS). */
  ip: string;
  puerto: number;
  /** Caracteres por línea: 48 en papel de 80 mm, 32 en papel de 58 mm. */
  columnas: number;
  /** Qué imprime: comandas de cocina, de barra y/o tickets de cliente. */
  imprimeCocina: boolean;
  imprimeBarra: boolean;
  imprimeTickets: boolean;
  /** Abre el cajón portamonedas al cobrar en efectivo. */
  abreCajon: boolean;
  activa: boolean;
};

export type TipoTrabajo = "comanda" | "ticket" | "precuenta" | "cierre" | "prueba";

/** Lo que se ha mandado a imprimir. Se guarda para poder verlo o reimprimirlo. */
export type TrabajoImpresion = {
  id: Id;
  creadoEn: FechaISO;
  tipo: TipoTrabajo;
  impresoraId: Id | null;
  /** En las comandas, si es de cocina o de barra. */
  destino?: Destino;
  titulo: string;
  /** Lo que sale en el papel (ver impresion/documento.ts). */
  documento: Bloque[];
  estado: "pendiente" | "impreso" | "error" | "en_navegador";
  error?: string;
};

export type Estado = {
  version: number;
  ajustes: Ajustes;
  empleados: Empleado[];
  zonas: Zona[];
  mesas: Mesa[];
  categorias: Categoria[];
  productos: Producto[];
  cuentas: Cuenta[];
  tickets: Ticket[];
  gastos: Gasto[];
  turnos: TurnoCaja[];
  avisos: Aviso[];
  impresoras: Impresora[];
  trabajos: TrabajoImpresion[];
  ingredientes: Ingrediente[];
  movimientosStock: MovimientoStock[];
  /** En la nube, solo los recientes y los abiertos: el resto está en su tabla (ver almacén). */
  fichajes: Fichaje[];
  cuadrante: TurnoCuadrante[];
  incidencias: Incidencia[];
  historial: EntradaHistorial[];
  reservas: Reserva[];
  pagosOnline: PagoOnline[];
  /** VERI*FACTU: registros por mandar a la AEAT y los últimos mandados. */
  verifactu?: {
    registros: RegistroAeat[];
    /** La AEAT pide esperar entre envíos (normalmente 60 s). */
    esperarHasta?: FechaISO;
    /** Si el último envío no llegó (sin red, certificado…), por qué. */
    ultimoError?: string;
  };
  /**
   * Códigos de 6 cifras para vincular un móvil o una tablet a este bar sin la cuenta del dueño.
   * Caducan a los 15 minutos y se usan una sola vez.
   */
  vinculos?: { codigo: string; caduca: FechaISO }[];
};
