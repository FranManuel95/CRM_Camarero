/**
 * El índice de la ayuda: temas, subtemas y sus preguntas (ids del manual). Cada entrada del
 * manual está en un solo sitio; `tests/unit/ayuda.test.ts` comprueba que no falta ninguna.
 */
export type Subtema = { nombre: string; entradas: string[] };
export type Tema = { id: string; nombre: string; subtemas: Subtema[] };

export const TEMAS: Tema[] = [
  {
    id: "sala",
    nombre: "Servicio en sala",
    subtemas: [
      {
        nombre: "Mesas",
        entradas: ["abrir-mesa", "vista-sala", "comensales", "mover-mesa", "anular-mesa", "avisos"],
      },
      {
        nombre: "Tomar nota y mandar",
        entradas: [
          "anotar",
          "elegir-carta",
          "rapidos",
          "agotado",
          "cantidad-quitar",
          "para-despues",
          "mandar",
          "servido",
        ],
      },
      { nombre: "Pedidos desde el QR", entradas: ["pedido-qr", "cliente-pide", "cliente-llama"] },
      {
        nombre: "Barra y para llevar",
        entradas: ["venta-rapida", "para-llevar", "pantalla-pedidos", "encargos-web"],
      },
    ],
  },
  {
    id: "cobrar",
    nombre: "Cobrar y cuentas",
    subtemas: [
      { nombre: "Cobrar", entradas: ["cobrar", "cobrar-partes", "propina", "precuenta"] },
      {
        nombre: "Precios, descuentos e invitaciones",
        entradas: ["precio-linea", "descuento", "invitar", "anular-linea"],
      },
      { nombre: "Tickets", entradas: ["reimprimir-ticket", "rectificar", "ticket-correo"] },
      { nombre: "Cuentas a deber", entradas: ["fiado", "cobrar-deuda"] },
    ],
  },
  {
    id: "caja",
    nombre: "Caja",
    subtemas: [
      { nombre: "Abrir y cerrar", entradas: ["abrir-caja", "cerrar-caja", "reimprimir-cierre"] },
      { nombre: "Dinero del cajón", entradas: ["meter-sacar"] },
    ],
  },
  {
    id: "cocina",
    nombre: "Cocina y barra",
    subtemas: [{ nombre: "Preparar los pedidos", entradas: ["cocina"] }],
  },
  {
    id: "reservas",
    nombre: "Reservas",
    subtemas: [
      { nombre: "El libro de reservas", entradas: ["reservas", "sentar-reserva"] },
      { nombre: "Reservas por internet", entradas: ["reservas-web"] },
    ],
  },
  {
    id: "carta",
    nombre: "Carta y precios",
    subtemas: [
      {
        nombre: "Productos",
        entradas: [
          "anadir-producto",
          "editar-producto",
          "borrar-producto",
          "ordenar-productos",
          "oculto",
          "favorito",
          "opciones",
          "alergenos",
          "menu-del-dia",
        ],
      },
      { nombre: "Categorías y cartas", entradas: ["categorias", "cartas", "carta-ingles"] },
      { nombre: "Cambiar precios", entradas: ["subir-precios", "tarifas"] },
      { nombre: "Cargar la carta", entradas: ["carta-foto"] },
    ],
  },
  {
    id: "mesas",
    nombre: "Mesas, plano y QR",
    subtemas: [
      {
        nombre: "El plano del local",
        entradas: ["mesas", "zonas", "decoracion", "distribuciones", "sin-ticket"],
      },
      { nombre: "Los QR de las mesas", entradas: ["qr-mesas", "qr-nuevo"] },
    ],
  },
  {
    id: "equipo",
    nombre: "Equipo",
    subtemas: [
      { nombre: "Personas y permisos", entradas: ["equipo", "permisos", "vincular", "entrar-pin"] },
      { nombre: "Fichajes y turnos", entradas: ["fichar", "fichajes", "cuadrante"] },
    ],
  },
  {
    id: "clientes",
    nombre: "Clientes y club",
    subtemas: [
      {
        nombre: "Club de clientes",
        entradas: ["club", "cliente-alta", "cliente-cuenta", "clientes-ofertas", "cliente-baja"],
      },
      { nombre: "Reseñas", entradas: ["resenas"] },
    ],
  },
  {
    id: "stock",
    nombre: "Stock y gastos",
    subtemas: [
      {
        nombre: "Almacén",
        entradas: ["ingredientes", "escandallo", "contar-stock", "recibir-pedido", "lista-compra"],
      },
      { nombre: "Gastos", entradas: ["gastos"] },
    ],
  },
  {
    id: "informes",
    nombre: "Informes y control",
    subtemas: [
      { nombre: "Cómo va el bar", entradas: ["resumen", "informes", "informe-camareros"] },
      { nombre: "Buscar y revisar", entradas: ["buscar-gestion", "historial"] },
    ],
  },
  {
    id: "impresoras",
    nombre: "Impresoras",
    subtemas: [
      {
        nombre: "Conectar",
        entradas: ["impresora-anadir", "impresora-puente", "impresora-pantalla"],
      },
      { nombre: "Si algo no sale", entradas: ["impresora-falla"] },
    ],
  },
  {
    id: "ajustes",
    nombre: "Ajustes del bar",
    subtemas: [
      {
        nombre: "Datos y forma de trabajar",
        entradas: [
          "datos-ticket",
          "ajustes-qr",
          "ajustes-servicio",
          "enlaces-clientes",
          "funciones",
        ],
      },
      { nombre: "Correo y copias", entradas: ["resumen-diario", "copias"] },
      { nombre: "Aparatos y conexión", entradas: ["instalar-app", "sin-wifi", "demostracion"] },
    ],
  },
  {
    id: "cuenta",
    nombre: "Tu cuenta y tus bares",
    subtemas: [
      { nombre: "Bares", entradas: ["alta-bar", "varios-bares", "panel-comanda"] },
      { nombre: "Entrar", entradas: ["entrar-cuenta", "olvide-clave"] },
      { nombre: "Legal", entradas: ["legal-plataforma"] },
    ],
  },
  {
    id: "hacienda",
    nombre: "Hacienda (VERI*FACTU)",
    subtemas: [{ nombre: "Mandar los tickets a Hacienda", entradas: ["verifactu"] }],
  },
];
