import { z } from "zod";
import { type Funcion, LISTA_FUNCIONES } from "./funciones";
import { ALERGENOS } from "./tipos";

/**
 * Todo lo que se puede hacer en el local, como mensajes validados. Las pantallas mandan una
 * acción al servidor; el servidor comprueba quién la manda, la aplica con `reducir` y avisa al
 * resto de pantallas. Así cocina, sala, caja y los móviles de los clientes ven lo mismo.
 */

const id = z.string().min(1).max(64);
const centimos = z.number().int().min(0).max(10_000_000);
const texto = (max = 200) => z.string().trim().max(max);
const iva = z.number().min(0).max(30);
const metodo = z.enum(["efectivo", "tarjeta", "bizum", "otro"]);
/** Al cobrar también se puede dejar a deber (fiado), si el bar lo usa. */
const metodoCobro = z.enum(["efectivo", "tarjeta", "bizum", "otro", "fiado"]);
/** Cantidad de stock: kilos, litros o unidades, con hasta tres decimales. */
const cantidad = z.number().min(0).max(1_000_000);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Día no válido");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");
/** Código de cuenta que pone el propio aparato (para seguir trabajando sin esperar respuesta). */
const idDelAparato = z.string().regex(/^sr-[a-z0-9-]{8,40}$/, "Identificador no válido");
const receta = z.array(z.object({ ingredienteId: id, cantidad: cantidad.positive() })).max(30);

const telefono = z
  .string()
  .trim()
  .regex(/^\+?[\d ]{9,16}$/, "Pon un teléfono de 9 cifras (o con prefijo)");
const correo = z.union([z.literal(""), z.email("Ese correo no parece bien escrito.").max(120)]);

export const lineaPedida = z.object({
  productoId: id,
  cantidad: z.number().int().min(1).max(99),
  /** Ids de las opciones elegidas, de cualquier grupo del producto. */
  opciones: z.array(id).max(30).default([]),
  nota: texto(140).default(""),
  /** «Para después»: se manda en espera y se prepara con la marcha. */
  despues: z.boolean().optional(),
});
export type LineaPedida = z.infer<typeof lineaPedida>;

const grupoOpciones = z.object({
  id,
  nombre: texto(60).min(1),
  nombreEn: texto(60).optional(),
  obligatorio: z.boolean(),
  multiple: z.boolean(),
  opciones: z
    .array(
      z.object({
        id,
        nombre: texto(60).min(1),
        nombreEn: texto(60).optional(),
        suplemento: centimos,
        destino: z.enum(["cocina", "barra"]).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const accionCamarero = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("abrir_cuenta"),
    mesaId: id,
    comensales: z.number().int().min(1).max(99),
    /** La pone el aparato cuando abre la mesa sin conexión, para anotar en ella después. */
    cuentaId: idDelAparato.optional(),
  }),
  z.object({
    tipo: z.literal("anotar"),
    cuentaId: id,
    lineas: z.array(lineaPedida).min(1).max(50),
  }),
  z.object({
    tipo: z.literal("cambiar_cantidad"),
    cuentaId: id,
    lineaId: id,
    cantidad: z.number().int().min(1).max(99),
  }),
  z.object({ tipo: z.literal("quitar_linea"), cuentaId: id, lineaId: id }),
  z.object({
    tipo: z.literal("anular_linea"),
    cuentaId: id,
    lineaId: id,
    motivo: texto(140).min(1),
  }),
  z.object({
    tipo: z.literal("invitar_linea"),
    cuentaId: id,
    lineaId: id,
    invitacion: z.boolean(),
  }),
  z.object({
    tipo: z.literal("enviar_comanda"),
    cuentaId: id,
    /** Si sale en papel. Sin decirlo, lo que diga Ajustes (normalmente sí). */
    imprimir: z.boolean().optional(),
  }),
  /** «Marcha»: lo que estaba en espera pasa a prepararse. */
  z.object({ tipo: z.literal("marchar"), cuentaId: id }),
  z.object({ tipo: z.literal("cambiar_despues"), cuentaId: id, lineaId: id, despues: z.boolean() }),
  z.object({ tipo: z.literal("aceptar_pedido_qr"), cuentaId: id }),
  z.object({ tipo: z.literal("rechazar_pedido_qr"), cuentaId: id }),
  z.object({ tipo: z.literal("marcar_lista"), cuentaId: id, lineaIds: z.array(id).min(1) }),
  z.object({ tipo: z.literal("volver_a_preparar"), cuentaId: id, lineaIds: z.array(id).min(1) }),
  z.object({ tipo: z.literal("marcar_servida"), cuentaId: id, lineaIds: z.array(id).min(1) }),
  z.object({
    tipo: z.literal("cambiar_comensales"),
    cuentaId: id,
    comensales: z.number().int().min(1).max(99),
  }),
  z.object({
    tipo: z.literal("aplicar_descuento"),
    cuentaId: id,
    descuento: z.number().min(0).max(100),
    /** Descuento en euros sobre el total (después del %). 0 lo quita; sin él, no se toca. */
    importe: centimos.optional(),
  }),
  /** Cambiar el precio o poner un descuento a una o varias líneas de la cuenta. */
  z.object({
    tipo: z.literal("ajustar_lineas"),
    cuentaId: id,
    lineaIds: z.array(id).min(1).max(100),
    cambio: z.discriminatedUnion("tipo", [
      /** Precio por unidad, con las opciones incluidas. */
      z.object({ tipo: z.literal("precio"), precio: centimos }),
      z.object({ tipo: z.literal("descuento"), porcentaje: z.number().min(0).max(100) }),
      /** Volver al precio de la carta, sin descuento. */
      z.object({ tipo: z.literal("original") }),
    ]),
  }),
  z.object({ tipo: z.literal("mover_cuenta"), cuentaId: id, mesaId: id }),
  z.object({ tipo: z.literal("imprimir_precuenta"), cuentaId: id }),
  z.object({
    tipo: z.literal("cobrar"),
    cuentaId: id,
    pagos: z
      .array(z.object({ metodo: metodoCobro, importe: centimos }))
      .min(1)
      .max(10),
    /** Cobrar solo estas líneas (y cuántas de cada una). Sin esto, se cobra todo lo pendiente. */
    partes: z
      .array(z.object({ lineaId: id, cantidad: z.number().int().min(1).max(99) }))
      .max(100)
      .optional(),
    propina: centimos.optional(),
  }),
  /** Cobrar sin abrir mesa (barra, para llevar): anota, manda y cobra de una vez. */
  z.object({
    tipo: z.literal("venta_rapida"),
    lineas: z.array(lineaPedida).min(1).max(50),
    pagos: z
      .array(z.object({ metodo: metodoCobro, importe: centimos }))
      .min(1)
      .max(10),
    propina: centimos.optional(),
  }),
  z.object({ tipo: z.literal("anular_cuenta"), cuentaId: id }),
  z.object({ tipo: z.literal("reimprimir_ticket"), ticketId: id }),
  z.object({ tipo: z.literal("rectificar_ticket"), ticketId: id }),
  z.object({ tipo: z.literal("atender_aviso"), avisoId: id }),
  z.object({
    tipo: z.literal("cambiar_disponible"),
    productoId: id,
    disponible: z.boolean(),
    /** Solo el encargado: ocultarlo a camareros y clientes. */
    oculto: z.boolean().optional(),
  }),
  // Caja
  z.object({ tipo: z.literal("abrir_caja"), fondoInicial: centimos }),
  z.object({
    tipo: z.literal("movimiento_caja"),
    movimiento: z.enum(["entrada", "salida"]),
    importe: centimos.min(1),
    motivo: texto(140).min(1),
  }),
  z.object({ tipo: z.literal("cerrar_caja"), efectivoContado: centimos }),
  z.object({ tipo: z.literal("reimprimir_cierre"), turnoId: id }),
  // Impresión
  z.object({ tipo: z.literal("reintentar_trabajo"), trabajoId: id }),
  // Stock: cualquiera del equipo puede contar lo que hay o apuntar lo que se tira.
  z.object({
    tipo: z.literal("ajustar_stock"),
    ingredienteId: id,
    /** «recuento»: lo que hay ahora; «merma»: lo que se ha tirado o roto. */
    ajuste: z.enum(["recuento", "merma"]),
    cantidad,
    nota: texto(140).default(""),
  }),
  // Para llevar y reservas: lo apunta quien coge el teléfono.
  z.object({
    tipo: z.literal("abrir_para_llevar"),
    nombre: texto(40).min(1, "Pon un nombre para llamarle al recoger"),
    telefono: texto(20),
    recogida: hora,
    cuentaId: idDelAparato.optional(),
  }),
  z.object({
    tipo: z.literal("guardar_reserva"),
    reserva: z.object({
      id: id.optional(),
      nombre: texto(40).min(1, "Pon a nombre de quién es"),
      telefono: texto(20),
      personas: z.number().int().min(1).max(99),
      dia,
      hora,
      mesaId: id.nullable(),
      nota: texto(200),
    }),
  }),
  z.object({
    tipo: z.literal("cambiar_reserva"),
    reservaId: id,
    estado: z.enum(["por_confirmar", "confirmada", "cancelada", "no_vino"]),
  }),
  /** Han llegado los de la reserva: se abre su mesa. */
  z.object({ tipo: z.literal("sentar_reserva"), reservaId: id, mesaId: id }),
  // Club de clientes: lo lleva quien está en la caja o en la mesa.
  z.object({
    tipo: z.literal("guardar_cliente"),
    cliente: z.object({
      id: id.optional(),
      nombre: texto(60).min(1, "Pon el nombre del cliente"),
      telefono,
      correo,
      alergenos: z.array(z.enum(ALERGENOS)).max(14),
      comunicaciones: z.boolean(),
      nota: texto(200),
    }),
    /** Al dar de alta: el cliente ha aceptado que se guarden sus datos para el club. */
    consentimiento: z.boolean().optional(),
    /** Al dar de alta desde una mesa: su cuenta ya suma puntos para él. */
    asignarA: id.optional(),
  }),
  z.object({ tipo: z.literal("asignar_cliente"), cuentaId: id, clienteId: id.nullable() }),
  /** Un cliente paga (todo o parte de) lo que debía. */
  z.object({
    tipo: z.literal("saldar_deuda"),
    clienteId: id,
    importe: centimos.min(1),
    metodo,
  }),
  z.object({ tipo: z.literal("canjear_puntos"), cuentaId: id, canjear: z.boolean() }),
  // Registro de jornada: cada uno ficha lo suyo.
  z.object({ tipo: z.literal("fichar"), que: z.enum(["entrada", "pausa", "vuelta", "salida"]) }),
]);

/** Solo el encargado: carta, plano, equipo, gastos, ajustes e impresoras. */
export const accionEncargado = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("guardar_gasto"),
    gasto: z.object({
      id: id.optional(),
      fecha: z.iso.datetime(),
      concepto: texto(120).min(1),
      categoria: z.enum([
        "proveedores",
        "personal",
        "alquiler",
        "suministros",
        "mantenimiento",
        "impuestos",
        "otros",
      ]),
      proveedor: texto(120),
      importe: centimos.min(1),
      iva,
      metodo,
      deCaja: z.boolean(),
    }),
  }),
  z.object({ tipo: z.literal("borrar_gasto"), gastoId: id }),
  z.object({
    tipo: z.literal("guardar_categoria"),
    categoria: z.object({
      id: id.optional(),
      nombre: texto(60).min(1),
      nombreEn: texto(60).optional(),
      orden: z.number().int(),
      destino: z.enum(["cocina", "barra"]),
      visibleEnQR: z.boolean(),
      horario: z
        .object({
          desde: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
          hasta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
          dias: z.array(z.number().int().min(0).max(6)).max(7),
        })
        .optional(),
    }),
  }),
  z.object({ tipo: z.literal("borrar_categoria"), categoriaId: id }),
  z.object({
    tipo: z.literal("guardar_producto"),
    producto: z.object({
      id: id.optional(),
      categoriaId: id,
      nombre: texto(80).min(1),
      descripcion: texto(400),
      nombreEn: texto(80).optional(),
      descripcionEn: texto(400).optional(),
      foto: z
        .string()
        .max(500)
        .regex(/^(https:\/\/|\/api\/fotos\/)/, "Foto no válida")
        .optional(),
      precio: centimos,
      iva,
      alergenos: z.array(z.enum(ALERGENOS)),
      disponible: z.boolean(),
      orden: z.number().int(),
      grupos: z.array(grupoOpciones).max(10),
      coste: centimos.optional(),
      receta: receta.optional(),
      oculto: z.boolean().optional(),
    }),
  }),
  z.object({ tipo: z.literal("borrar_producto"), productoId: id }),
  z.object({
    tipo: z.literal("guardar_ingrediente"),
    ingrediente: z.object({
      id: id.optional(),
      nombre: texto(60).min(1),
      unidad: z.enum(["kg", "l", "ud"]),
      /** Solo al darlo de alta; luego cambia con compras, recuentos y mermas. */
      existencias: cantidad.optional(),
      minimo: cantidad,
      pedirHasta: cantidad.optional(),
      coste: centimos,
      proveedor: texto(120),
    }),
  }),
  z.object({ tipo: z.literal("borrar_ingrediente"), ingredienteId: id }),
  /** Llega un pedido del proveedor: suma al stock, actualiza precios y apunta el gasto. */
  z.object({
    tipo: z.literal("recibir_compra"),
    proveedor: texto(120),
    lineas: z
      .array(
        z.object({
          ingredienteId: id,
          cantidad: cantidad.positive(),
          /** Lo que cuesta esta línea en la factura, con IVA. 0 si no se sabe. */
          importe: centimos,
        }),
      )
      .min(1)
      .max(60),
    apuntarGasto: z.boolean(),
    iva,
    metodo,
    deCaja: z.boolean(),
  }),
  z.object({
    tipo: z.literal("guardar_zona"),
    zona: z.object({ id: id.optional(), nombre: texto(40).min(1), orden: z.number().int() }),
  }),
  z.object({ tipo: z.literal("borrar_zona"), zonaId: id }),
  z.object({
    tipo: z.literal("guardar_mesa"),
    mesa: z.object({
      id: id.optional(),
      nombre: texto(30).min(1),
      zonaId: id,
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      ancho: z.number().min(4).max(60),
      alto: z.number().min(4).max(60),
      forma: z.enum(["cuadrada", "redonda", "alargada"]),
      plazas: z.number().int().min(1).max(40),
    }),
  }),
  z.object({ tipo: z.literal("borrar_mesa"), mesaId: id }),
  z.object({ tipo: z.literal("regenerar_qr"), mesaId: id }),
  z.object({
    tipo: z.literal("guardar_empleado"),
    empleado: z.object({
      id: id.optional(),
      nombre: texto(40).min(1),
      /** Vacío al editar = se queda el PIN que tenía. */
      pin: z.union([z.literal(""), z.string().regex(/^\d{4,6}$/, "El PIN son de 4 a 6 cifras")]),
      rol: z.enum(["camarero", "encargado"]),
      activo: z.boolean(),
    }),
  }),
  z.object({
    tipo: z.literal("guardar_ajustes"),
    ajustes: z.object({
      nombreLocal: texto(60).min(1),
      razonSocial: texto(120),
      nif: texto(20),
      direccion: texto(160),
      telefono: texto(30),
      ivaPorDefecto: iva,
      confirmarPedidosQR: z.boolean(),
      pedidosQRActivos: z.boolean(),
      pieTicket: texto(200),
      serieTicket: z.string().regex(/^[A-Z0-9-]{1,10}$/, "Solo mayúsculas, números y guiones"),
      imprimirComandas: z.boolean().optional(),
      preciosSoloEncargado: z.boolean().optional(),
      enlaceResena: z
        .union([
          z.literal(""),
          z.url({ protocol: /^https$/, error: "El enlace empieza por https://" }),
        ])
        .optional(),
    }),
  }),
  z.object({
    tipo: z.literal("guardar_impresora"),
    impresora: z.object({
      id: id.optional(),
      nombre: texto(40).min(1),
      conexion: z.enum(["red", "navegador"]),
      ip: z.union([z.literal(""), z.ipv4()]),
      puerto: z.number().int().min(1).max(65535),
      columnas: z.number().int().min(24).max(64),
      imprimeCocina: z.boolean(),
      imprimeBarra: z.boolean(),
      imprimeTickets: z.boolean(),
      abreCajon: z.boolean(),
      activa: z.boolean(),
    }),
  }),
  z.object({ tipo: z.literal("borrar_impresora"), impresoraId: id }),
  z.object({ tipo: z.literal("imprimir_prueba"), impresoraId: id }),
  z.object({ tipo: z.literal("crear_codigo_vinculo") }),
  /** Encender o apagar una función del bar (ver funciones.ts). */
  z.object({
    tipo: z.literal("cambiar_funcion"),
    funcion: z.enum(LISTA_FUNCIONES as [Funcion, ...Funcion[]]),
    activa: z.boolean(),
  }),
  /** Corregir (o apuntar a mano) un fichaje. Queda anotado quién, cuándo y por qué. */
  z.object({
    tipo: z.literal("corregir_fichaje"),
    fichajeId: id.optional(),
    empleadoId: id,
    entrada: z.iso.datetime(),
    salida: z.iso.datetime().nullable(),
    pausas: z
      .array(z.object({ inicio: z.iso.datetime(), fin: z.iso.datetime().nullable() }))
      .max(10),
    motivo: texto(200).min(3, "Explica por qué se corrige"),
  }),
  z.object({
    tipo: z.literal("guardar_turno"),
    turno: z.object({
      id: id.optional(),
      empleadoId: id,
      dia,
      desde: hora,
      hasta: hora,
      puesto: texto(30),
    }),
  }),
  z.object({ tipo: z.literal("borrar_turno"), turnoId: id }),
  /** El cliente pide que se borren sus datos (derecho de supresión). */
  z.object({ tipo: z.literal("baja_cliente"), clienteId: id }),
  z.object({
    tipo: z.literal("reglas_club"),
    reglas: z.object({
      puntosPorEuro: z.number().min(0).max(100),
      puntosPremio: z.number().int().min(1).max(100_000),
      valorPremio: centimos.min(1),
      bienvenida: z.number().int().min(0).max(10_000),
    }),
  }),
  z.object({
    tipo: z.literal("guardar_tarifas"),
    tarifas: z
      .array(
        z.object({
          id,
          nombre: texto(40).min(1, "Pon un nombre a cada precio especial"),
          porcentaje: z.number().min(-100).max(200),
          horario: z
            .object({
              desde: hora,
              hasta: hora,
              dias: z.array(z.number().int().min(0).max(6)).max(7),
            })
            .optional(),
          categoriaIds: z.array(id).max(100),
          zonaIds: z.array(id).max(50),
          activa: z.boolean(),
        }),
      )
      .max(30),
  }),
  /** Copia los turnos de una semana en otra (los lunes de cada una). */
  z.object({ tipo: z.literal("copiar_semana"), desde: dia, hacia: dia }),
]);

export const accionPersonal = z.union([accionCamarero, accionEncargado]);
export type AccionCamarero = z.infer<typeof accionCamarero>;
export type AccionEncargado = z.infer<typeof accionEncargado>;

/** Lo que puede hacer un cliente desde el QR de su mesa. Nada más. */
export const accionCliente = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("pedir"), lineas: z.array(lineaPedida).min(1).max(30) }),
  z.object({ tipo: z.literal("llamar_camarero") }),
  z.object({ tipo: z.literal("pedir_cuenta"), metodo: z.enum(["efectivo", "tarjeta", "bizum"]) }),
  /** El cliente suma la cuenta de su mesa a su tarjeta del club. */
  z.object({ tipo: z.literal("sumar_al_club"), codigo: z.string().min(8).max(64) }),
]);

/** Alta en el club desde el móvil del cliente (con su consentimiento expreso). */
export const altaClub = z.object({
  nombre: texto(60).min(1, "Dinos tu nombre"),
  telefono,
  correo,
  comunicaciones: z.boolean(),
  acepto: z.literal(true, { error: "Hace falta que aceptes para apuntarte" }),
  /** QR de la mesa desde la que se apunta: su cuenta empieza ya a sumar puntos. */
  mesa: z.string().max(64).optional(),
});
export type AltaClub = z.infer<typeof altaClub>;
export type AccionCliente = z.infer<typeof accionCliente>;

/** Un encargo para llevar desde la web del bar (luego se pide con la carta, como en una mesa). */
export const encargoOnline = z.object({
  nombre: texto(40).min(1, "Dinos tu nombre"),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d ]{9,15}$/, "Pon un teléfono para avisarte si hay algún problema"),
  recogida: hora,
});
export type EncargoOnline = z.infer<typeof encargoOnline>;

/** Una petición de reserva desde la web del bar (el bar la confirma). */
export const reservaOnline = z.object({
  nombre: texto(40).min(1, "Dinos a nombre de quién"),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d ]{9,15}$/, "Pon un teléfono para confirmarte la reserva"),
  personas: z.number().int().min(1).max(20),
  dia,
  hora,
  nota: texto(200).default(""),
});
export type ReservaOnline = z.infer<typeof reservaOnline>;

export type AccionPersonal = z.infer<typeof accionPersonal>;

export function esAccionDeEncargado(tipo: string): boolean {
  return accionEncargado.options.some((o) => o.shape.tipo.value === tipo);
}
