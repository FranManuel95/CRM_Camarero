import { z } from "zod";
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
/** Cantidad de stock: kilos, litros o unidades, con hasta tres decimales. */
const cantidad = z.number().min(0).max(1_000_000);
const receta = z
  .array(z.object({ ingredienteId: id, cantidad: cantidad.positive() }))
  .max(30);

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
  z.object({ tipo: z.literal("enviar_comanda"), cuentaId: id }),
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
  }),
  z.object({ tipo: z.literal("mover_cuenta"), cuentaId: id, mesaId: id }),
  z.object({ tipo: z.literal("imprimir_precuenta"), cuentaId: id }),
  z.object({
    tipo: z.literal("cobrar"),
    cuentaId: id,
    pagos: z
      .array(z.object({ metodo, importe: centimos }))
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
      .array(z.object({ metodo, importe: centimos }))
      .min(1)
      .max(10),
    propina: centimos.optional(),
  }),
  z.object({ tipo: z.literal("anular_cuenta"), cuentaId: id }),
  z.object({ tipo: z.literal("reimprimir_ticket"), ticketId: id }),
  z.object({ tipo: z.literal("rectificar_ticket"), ticketId: id }),
  z.object({ tipo: z.literal("atender_aviso"), avisoId: id }),
  z.object({ tipo: z.literal("cambiar_disponible"), productoId: id, disponible: z.boolean() }),
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
]);

export const accionPersonal = z.union([accionCamarero, accionEncargado]);
export type AccionCamarero = z.infer<typeof accionCamarero>;
export type AccionEncargado = z.infer<typeof accionEncargado>;

/** Lo que puede hacer un cliente desde el QR de su mesa. Nada más. */
export const accionCliente = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("pedir"), lineas: z.array(lineaPedida).min(1).max(30) }),
  z.object({ tipo: z.literal("llamar_camarero") }),
  z.object({ tipo: z.literal("pedir_cuenta"), metodo: z.enum(["efectivo", "tarjeta", "bizum"]) }),
]);
export type AccionCliente = z.infer<typeof accionCliente>;

export type AccionPersonal = z.infer<typeof accionPersonal>;

export function esAccionDeEncargado(tipo: string): boolean {
  return accionEncargado.options.some((o) => o.shape.tipo.value === tipo);
}
