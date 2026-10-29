import type { AccionPersonal } from "./acciones";
import { VERSION_ESTADO } from "./migraciones";
import { resumenPin } from "./pin";
import { type Contexto, cuentaDeMesa, reducirPersonal } from "./reducir";
import { diasDeSemana, instante, lunesDe } from "./equipo";
import { totalCuenta } from "./importes";
import { sumarDias } from "./informes";
import { apuntarTiempos } from "./tiempos";
import type {
  Alergeno,
  Categoria,
  Estado,
  Ingrediente,
  Mesa,
  Producto,
  Reserva,
  TurnoCuadrante,
  Zona,
} from "./tipos";
import { diaLocal } from "../fechas";

/**
 * El bar de ejemplo con el que arranca la aplicación: «La Esquina», ficticio. Incluye dos
 * semanas de ventas y gastos inventados para que los informes tengan algo que enseñar.
 * Todos los datos son inventados.
 */

/** Generador pseudoaleatorio con semilla: los datos de ejemplo salen siempre iguales. */
export function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Plato = [nombre: string, precio: number, alergenos: Alergeno[], descripcion?: string];

const CARTA: { categoria: Omit<Categoria, "id" | "orden">; platos: Plato[] }[] = [
  {
    categoria: { nombre: "Cervezas", destino: "barra", visibleEnQR: true },
    platos: [
      ["Caña", 200, ["gluten"], "De barril, bien tirada."],
      ["Doble", 300, ["gluten"]],
      ["Tercio", 280, ["gluten"]],
      ["Cerveza sin alcohol", 270, ["gluten"]],
      ["Clara con limón", 230, ["gluten"]],
    ],
  },
  {
    categoria: { nombre: "Vinos", destino: "barra", visibleEnQR: true },
    platos: [
      ["Copa de tinto Rioja", 320, ["sulfitos"]],
      ["Copa de Ribera", 350, ["sulfitos"]],
      ["Copa de Verdejo", 300, ["sulfitos"]],
      ["Tinto de verano", 300, ["sulfitos"]],
      ["Vermut de grifo", 300, ["sulfitos"], "Con su naranja y su aceituna."],
    ],
  },
  {
    categoria: { nombre: "Refrescos y agua", destino: "barra", visibleEnQR: true },
    platos: [
      ["Agua mineral", 180, []],
      ["Refresco de cola", 250, []],
      ["Refresco de naranja", 250, []],
      ["Tónica", 250, []],
      ["Zumo de naranja natural", 350, []],
    ],
  },
  {
    categoria: { nombre: "Cafés", destino: "barra", visibleEnQR: true },
    platos: [
      ["Café solo", 140, []],
      ["Cortado", 150, ["lacteos"]],
      ["Café con leche", 170, ["lacteos"]],
      ["Infusión", 160, []],
      ["Colacao", 190, ["lacteos"]],
    ],
  },
  {
    categoria: { nombre: "Tapas", destino: "cocina", visibleEnQR: true },
    platos: [
      [
        "Croquetas de jamón (4 uds.)",
        650,
        ["gluten", "lacteos", "huevo"],
        "Caseras, cremosas por dentro.",
      ],
      ["Patatas bravas", 550, ["huevo"], "Con salsa brava de la casa y alioli."],
      ["Tortilla de patatas (pincho)", 300, ["huevo"]],
      ["Ensaladilla rusa", 550, ["huevo", "pescado"]],
      ["Pimientos de Padrón", 600, []],
      ["Boquerones en vinagre", 650, ["pescado", "sulfitos"]],
    ],
  },
  {
    categoria: { nombre: "Raciones", destino: "cocina", visibleEnQR: true },
    platos: [
      ["Calamares a la andaluza", 1200, ["gluten", "moluscos"]],
      ["Pulpo a la gallega", 1650, ["moluscos"]],
      ["Huevos rotos con jamón", 1100, ["huevo"]],
      ["Secreto ibérico", 1450, [], "Con patatas y pimientos."],
      ["Gambas al ajillo", 1350, ["crustaceos"]],
      ["Ensalada de la casa", 900, ["huevo", "pescado"]],
    ],
  },
  {
    categoria: { nombre: "Bocadillos", destino: "cocina", visibleEnQR: true },
    platos: [
      ["Bocadillo de calamares", 650, ["gluten", "moluscos"]],
      ["Pepito de ternera", 750, ["gluten"]],
      ["Bocadillo vegetal", 600, ["gluten", "huevo", "mostaza"]],
      ["Hamburguesa La Esquina", 1150, ["gluten", "lacteos", "sesamo", "mostaza"]],
    ],
  },
  {
    categoria: { nombre: "Postres", destino: "cocina", visibleEnQR: true },
    platos: [
      ["Tarta de queso", 550, ["lacteos", "huevo", "gluten"], "Al horno, poco hecha por dentro."],
      ["Flan casero", 450, ["lacteos", "huevo"]],
      ["Torrija", 500, ["gluten", "lacteos", "huevo"]],
    ],
  },
];

/** Nombres en inglés para la carta QR de ejemplo. */
const EN_INGLES: Record<string, string> = {
  Cervezas: "Beers",
  Vinos: "Wines",
  "Refrescos y agua": "Soft drinks & water",
  Cafés: "Coffee & tea",
  Tapas: "Tapas",
  Raciones: "Sharing plates",
  Bocadillos: "Sandwiches",
  Postres: "Desserts",
  Caña: "Small draught beer",
  Doble: "Large draught beer",
  Tercio: "Bottled beer",
  "Cerveza sin alcohol": "Alcohol-free beer",
  "Clara con limón": "Beer with lemonade",
  "Copa de tinto Rioja": "Glass of Rioja red",
  "Copa de Ribera": "Glass of Ribera red",
  "Copa de Verdejo": "Glass of Verdejo white",
  "Tinto de verano": "Red wine with lemonade",
  "Vermut de grifo": "Vermouth on tap",
  "Agua mineral": "Mineral water",
  "Refresco de cola": "Cola",
  "Refresco de naranja": "Orange soda",
  Tónica: "Tonic water",
  "Zumo de naranja natural": "Fresh orange juice",
  "Café solo": "Espresso",
  Cortado: "Cortado (espresso with a dash of milk)",
  "Café con leche": "White coffee",
  Infusión: "Herbal tea",
  Colacao: "Hot chocolate milk",
  "Croquetas de jamón (4 uds.)": "Ham croquettes (4)",
  "Patatas bravas": "Patatas bravas (spicy potatoes)",
  "Tortilla de patatas (pincho)": "Spanish omelette (slice)",
  "Ensaladilla rusa": "Russian salad",
  "Pimientos de Padrón": "Padrón peppers",
  "Boquerones en vinagre": "Anchovies in vinegar",
  "Calamares a la andaluza": "Fried squid",
  "Pulpo a la gallega": "Galician-style octopus",
  "Huevos rotos con jamón": "Fried eggs with ham and chips",
  "Secreto ibérico": "Iberian pork steak",
  "Gambas al ajillo": "Garlic prawns",
  "Ensalada de la casa": "House salad",
  "Bocadillo de calamares": "Fried squid sandwich",
  "Pepito de ternera": "Beef steak sandwich",
  "Bocadillo vegetal": "Veggie sandwich",
  "Hamburguesa La Esquina": "La Esquina burger",
  "Tarta de queso": "Cheesecake",
  "Flan casero": "Homemade flan",
  Torrija: "Spanish French toast",
};

export function estadoDeEjemplo(ctx: Contexto, opciones: { conHistorial?: boolean } = {}): Estado {
  const zonas: Zona[] = ["Barra", "Salón", "Terraza"].map((nombre, orden) => ({
    id: `zona-${orden + 1}`,
    nombre,
    orden,
  }));
  const mesas: Mesa[] = [];
  const nuevaMesa = (
    nombre: string,
    zonaId: string,
    x: number,
    y: number,
    forma: Mesa["forma"],
    plazas: number,
  ) =>
    mesas.push({
      id: `mesa-${mesas.length + 1}`,
      nombre,
      zonaId,
      x,
      y,
      ancho: forma === "alargada" ? 21 : 14,
      alto: 14,
      forma,
      plazas,
      token: ctx.nuevoToken(),
    });
  for (let i = 0; i < 5; i++) nuevaMesa(`Barra ${i + 1}`, "zona-1", 6 + i * 18, 20, "redonda", 1);
  for (let i = 0; i < 8; i++)
    nuevaMesa(
      `Mesa ${i + 1}`,
      "zona-2",
      4 + (i % 4) * 25,
      12 + Math.floor(i / 4) * 34,
      i % 3 === 2 ? "alargada" : "cuadrada",
      i % 3 === 2 ? 6 : 4,
    );
  for (let i = 0; i < 6; i++)
    nuevaMesa(
      `Terraza ${i + 1}`,
      "zona-3",
      6 + (i % 3) * 30,
      12 + Math.floor(i / 3) * 40,
      "redonda",
      4,
    );

  const categorias: Categoria[] = [];
  const productos: Producto[] = [];
  CARTA.forEach(({ categoria, platos }, i) => {
    const id = `cat-${i + 1}`;
    categorias.push({ id, orden: i, ...categoria, nombreEn: EN_INGLES[categoria.nombre] });
    platos.forEach(([nombre, precio, alergenos, descripcion], j) => {
      productos.push({
        id: `prod-${i + 1}-${j + 1}`,
        categoriaId: id,
        nombre,
        nombreEn: EN_INGLES[nombre],
        descripcion: descripcion ?? "",
        precio,
        iva: 10,
        alergenos,
        disponible: true,
        orden: j,
        grupos: [],
        coste: Math.round(precio * (categoria.destino === "barra" ? 0.25 : 0.32)),
      });
    });
  });
  const buscarProducto = (nombre: string) => productos.find((p) => p.nombre === nombre)!;
  buscarProducto("Secreto ibérico").grupos = [
    {
      id: "g-punto",
      nombre: "Punto",
      obligatorio: true,
      multiple: false,
      opciones: [
        { id: "o-poco", nombre: "Poco hecho", suplemento: 0 },
        { id: "o-punto", nombre: "Al punto", suplemento: 0 },
        { id: "o-hecho", nombre: "Hecho", suplemento: 0 },
      ],
    },
  ];
  buscarProducto("Hamburguesa La Esquina").grupos = [
    {
      id: "g-hpunto",
      nombre: "Punto",
      obligatorio: true,
      multiple: false,
      opciones: [
        { id: "o-hpoco", nombre: "Poco hecha", suplemento: 0 },
        { id: "o-hpunto", nombre: "Al punto", suplemento: 0 },
        { id: "o-hhecha", nombre: "Muy hecha", suplemento: 0 },
      ],
    },
    {
      id: "g-extras",
      nombre: "Extras",
      obligatorio: false,
      multiple: true,
      opciones: [
        { id: "o-bacon", nombre: "Bacon", suplemento: 150 },
        { id: "o-huevo", nombre: "Huevo frito", suplemento: 120 },
        { id: "o-singluten", nombre: "Pan sin gluten", suplemento: 100 },
      ],
    },
  ];
  buscarProducto("Café con leche").grupos = [
    {
      id: "g-leche",
      nombre: "Leche",
      obligatorio: false,
      multiple: false,
      opciones: [
        { id: "o-entera", nombre: "Entera", suplemento: 0 },
        { id: "o-desnatada", nombre: "Desnatada", suplemento: 0 },
        { id: "o-avena", nombre: "De avena", suplemento: 30 },
        { id: "o-sinlactosa", nombre: "Sin lactosa", suplemento: 0 },
      ],
    },
  ];

  let estado: Estado = {
    version: VERSION_ESTADO,
    ajustes: {
      nombreLocal: "La Esquina",
      razonSocial: "Bar La Esquina, S.L. (ficticio)",
      nif: "B00000000",
      direccion: "Calle Inventada, 1 · 00000 Ciudad",
      telefono: "600 000 000",
      ivaPorDefecto: 10,
      confirmarPedidosQR: true,
      pedidosQRActivos: true,
      pieTicket: "¡Gracias por venir! Te esperamos pronto.",
      serieTicket: "T",
    },
    empleados: [
      { id: "emp-1", nombre: "Ana", pin: resumenPin("1234"), rol: "encargado", activo: true },
      { id: "emp-2", nombre: "Luis", pin: resumenPin("1111"), rol: "camarero", activo: true },
      { id: "emp-3", nombre: "Marta", pin: resumenPin("2222"), rol: "camarero", activo: true },
    ],
    zonas,
    mesas,
    categorias,
    productos,
    cuentas: [],
    tickets: [],
    gastos: [],
    turnos: [],
    avisos: [],
    impresoras: [
      {
        id: "imp-1",
        nombre: "Caja (desde el navegador)",
        conexion: "navegador",
        ip: "",
        puerto: 9100,
        columnas: 48,
        imprimeCocina: false,
        imprimeBarra: false,
        imprimeTickets: true,
        abreCajon: false,
        activa: true,
      },
    ],
    trabajos: [],
    ingredientes: [],
    movimientosStock: [],
    fichajes: [],
    cuadrante: [],
    incidencias: [],
    historial: [],
    reservas: reservasDeEjemplo(ctx.ahora, mesas),
    clientes: [],
  };

  estado.cuadrante = cuadranteDeEjemplo(
    ctx.ahora,
    estado.empleados.map((e) => e.id),
  );
  if (opciones.conHistorial) estado = conHistorial(estado, ctx);
  // El stock se pone al final: así el historial de ejemplo no lo gasta.
  return conStock(estado);
}

/**
 * Turnos de cada persona del ejemplo (por orden: Ana, Luis, Marta): Ana de mañana, Luis de mañana
 * a tarde y Marta de tarde a noche. Los lunes se cierra y cada uno libra otro día (0 = lunes).
 */
const PLAN_EQUIPO: [desde: string, hasta: string, puesto: string, libra: number][] = [
  ["10:00", "18:00", "Barra", 6],
  ["11:00", "17:00", "Sala", 3],
  ["17:00", "00:00", "Sala", 2],
];

/** El turno del plan de una persona un día («2026-10-27»), o nada si ese día no trabaja. */
function turnoDelPlan(indice: number, dia: string) {
  const plan = PLAN_EQUIPO[indice];
  const semana = (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (!plan || semana === 0 || semana === plan[3]) return null;
  return { desde: plan[0], hasta: plan[1], puesto: plan[2] };
}

/** Turnos de las tres semanas del historial, esta y la siguiente, según el plan. */
function cuadranteDeEjemplo(ahora: string, empleados: string[]): TurnoCuadrante[] {
  const lunes = lunesDe(ahora.slice(0, 10));
  return [-21, -14, -7, 0, 7].flatMap((semana) =>
    diasDeSemana(sumarDias(lunes, semana)).flatMap((dia) =>
      empleados.flatMap((empleadoId, i) => {
        const t = turnoDelPlan(i, dia);
        return t ? [{ id: `tc-${dia}-${empleadoId}`, empleadoId, dia, ...t }] : [];
      }),
    ),
  );
}

type IngredienteEjemplo = [
  id: string,
  nombre: string,
  unidad: Ingrediente["unidad"],
  existencias: number,
  minimo: number,
  pedirHasta: number,
  coste: number,
  proveedor: string,
];

const INGREDIENTES: IngredienteEjemplo[] = [
  ["ing-cerveza", "Cerveza de barril", "l", 62, 30, 90, 160, "Distribuciones Ficticias"],
  ["ing-tinto", "Vino tinto Rioja", "l", 9, 4, 12, 650, "Bodegas Inventadas"],
  ["ing-cafe", "Café en grano", "kg", 2.4, 1, 4, 1800, "Cafés Ejemplo"],
  ["ing-leche", "Leche entera", "l", 7, 6, 18, 95, "Lácteos Ficticios"],
  ["ing-patata", "Patatas", "kg", 14, 8, 25, 110, "Huerta Ejemplo"],
  ["ing-huevo", "Huevos", "ud", 54, 30, 120, 25, "Huerta Ejemplo"],
  ["ing-aceite", "Aceite de oliva", "l", 6, 5, 15, 900, "Distribuciones Ficticias"],
  ["ing-croqueta", "Croquetas de jamón", "ud", 48, 40, 160, 45, "Obrador Inventado"],
  ["ing-calamar", "Calamar limpio", "kg", 3.2, 2, 6, 1400, "Lonja Inventada"],
  ["ing-pulpo", "Pulpo cocido", "kg", 0.9, 1.5, 4, 2600, "Lonja Inventada"],
  ["ing-jamon", "Jamón serrano", "kg", 1.8, 1, 3, 2200, "Carnicería Ejemplo"],
  ["ing-pan", "Pan de barra", "ud", 12, 10, 30, 70, "Panadería Ejemplo"],
];

/** Escandallos de ejemplo: [plato, [ingrediente, cantidad por ración]…]. */
const RECETAS: [string, [string, number][]][] = [
  ["Caña", [["ing-cerveza", 0.2]]],
  ["Doble", [["ing-cerveza", 0.33]]],
  ["Clara con limón", [["ing-cerveza", 0.15]]],
  ["Copa de tinto Rioja", [["ing-tinto", 0.15]]],
  ["Tinto de verano", [["ing-tinto", 0.1]]],
  ["Café solo", [["ing-cafe", 0.008]]],
  [
    "Cortado",
    [
      ["ing-cafe", 0.008],
      ["ing-leche", 0.03],
    ],
  ],
  [
    "Café con leche",
    [
      ["ing-cafe", 0.008],
      ["ing-leche", 0.15],
    ],
  ],
  ["Croquetas de jamón (4 uds.)", [["ing-croqueta", 4]]],
  [
    "Patatas bravas",
    [
      ["ing-patata", 0.3],
      ["ing-aceite", 0.05],
    ],
  ],
  [
    "Tortilla de patatas (pincho)",
    [
      ["ing-patata", 0.08],
      ["ing-huevo", 1],
      ["ing-aceite", 0.02],
    ],
  ],
  [
    "Calamares a la andaluza",
    [
      ["ing-calamar", 0.25],
      ["ing-aceite", 0.05],
    ],
  ],
  [
    "Pulpo a la gallega",
    [
      ["ing-pulpo", 0.25],
      ["ing-patata", 0.15],
      ["ing-aceite", 0.02],
    ],
  ],
  [
    "Huevos rotos con jamón",
    [
      ["ing-huevo", 2],
      ["ing-patata", 0.25],
      ["ing-jamon", 0.05],
      ["ing-aceite", 0.05],
    ],
  ],
  [
    "Bocadillo de calamares",
    [
      ["ing-calamar", 0.15],
      ["ing-pan", 1],
      ["ing-aceite", 0.03],
    ],
  ],
  [
    "Bocadillo vegetal",
    [
      ["ing-pan", 1],
      ["ing-huevo", 1],
    ],
  ],
];

/** Ingredientes con existencias y los escandallos de los platos de la carta de ejemplo. */
function conStock(estado: Estado): Estado {
  const ingredientes: Ingrediente[] = INGREDIENTES.map(
    ([id, nombre, unidad, existencias, minimo, pedirHasta, coste, proveedor]) => ({
      id,
      nombre,
      unidad,
      existencias,
      minimo,
      pedirHasta,
      coste,
      proveedor,
    }),
  );
  const productos = estado.productos.map((p) => {
    const receta = RECETAS.find(([nombre]) => nombre === p.nombre)?.[1];
    if (!receta) return p;
    return {
      ...p,
      receta: receta.map(([ingredienteId, cantidad]) => ({ ingredienteId, cantidad })),
    };
  });
  return { ...estado, ingredientes, productos };
}

/** Simula dos semanas de servicio, pasando por las mismas acciones que usa la app. */
function conHistorial(inicial: Estado, ctx: Contexto): Estado {
  const azar = aleatorio(20261024);
  let estado = inicial;
  const hoy = new Date(ctx.ahora);
  const [ana, ...camareros] = estado.empleados;
  if (!ana) return estado;
  const elegir = <T>(lista: T[]): T => lista[Math.floor(azar() * lista.length)]!;

  const hacer = (accion: AccionPersonal, cuando: Date, quien = ana) => {
    estado = reducirPersonal(estado, accion, quien, { ...ctx, ahora: cuando.toISOString() }).estado;
  };

  for (let diasAtras = 14; diasAtras >= 0; diasAtras--) {
    const dia = new Date(hoy);
    dia.setUTCDate(dia.getUTCDate() - diasAtras);
    const a = (h: number, m = 0) => {
      const d = new Date(dia);
      d.setUTCHours(h, m, 0, 0);
      return d;
    };
    // Los lunes cerrado.
    if (dia.getUTCDay() === 1 && diasAtras > 0) continue;
    const apertura = diasAtras === 0 ? new Date(hoy.getTime() - 3_600_000) : a(10);
    hacer({ tipo: "abrir_caja", fondoInicial: 15000 }, apertura);
    // Fichajes según el cuadrante, con unos minutos arriba o abajo. Hoy, quien ya ha empezado
    // su turno está trabajando.
    const diaClave = dia.toISOString().slice(0, 10);
    for (const [i, quien] of estado.empleados.entries()) {
      const turno = turnoDelPlan(i, diaClave);
      if (!turno) continue;
      const minutos = (n: number) => n * 60_000;
      const entrada = new Date(
        Date.parse(instante(diaClave, turno.desde)) + minutos(Math.floor(azar() * 14) - 9),
      );
      if (diasAtras === 0) {
        if (entrada < hoy) hacer({ tipo: "fichar", que: "entrada" }, entrada, quien);
        continue;
      }
      const fin = instante(
        turno.hasta < turno.desde ? sumarDias(diaClave, 1) : diaClave,
        turno.hasta,
      );
      const salida = new Date(Date.parse(fin) + minutos(Math.floor(azar() * 16)));
      const pausa = new Date((entrada.getTime() + salida.getTime()) / 2);
      hacer({ tipo: "fichar", que: "entrada" }, entrada, quien);
      hacer({ tipo: "fichar", que: "pausa" }, pausa, quien);
      hacer({ tipo: "fichar", que: "vuelta" }, new Date(pausa.getTime() + minutos(30)), quien);
      hacer({ tipo: "fichar", que: "salida" }, salida, quien);
    }
    if (diasAtras === 0) break;

    const finDeSemana = [0, 5, 6].includes(dia.getUTCDay());
    const servicios = Math.round((finDeSemana ? 34 : 20) + azar() * 10);
    let efectivo = 15000;
    for (let s = 0; s < servicios; s++) {
      const mesa = elegir(estado.mesas.filter((m) => !cuentaDeMesa(estado, m.id)));
      const quien = elegir(camareros);
      // Repartidas de 11:00 a 22:00 y siempre en orden: los tickets salen en el orden de la
      // cadena de huellas, como en un bar de verdad.
      const hora = new Date(
        a(11).getTime() + (s * 11 * 3_600_000) / servicios + Math.floor(azar() * 5) * 60_000,
      );
      hacer(
        {
          tipo: "abrir_cuenta",
          mesaId: mesa.id,
          comensales: 1 + Math.floor(azar() * Math.min(4, mesa.plazas)),
        },
        hora,
        quien,
      );
      const cuenta = cuentaDeMesa(estado, mesa.id)!;
      const lineas = Array.from({ length: 1 + Math.floor(azar() * 5) }, () => {
        const producto = elegir(
          estado.productos.filter((p) => p.grupos.every((g) => !g.obligatorio)),
        );
        return {
          productoId: producto.id,
          cantidad: 1 + Math.floor(azar() * 3),
          opciones: [],
          nota: "",
        };
      });
      hacer({ tipo: "anotar", cuentaId: cuenta.id, lineas }, hora, quien);
      hacer({ tipo: "enviar_comanda", cuentaId: cuenta.id }, hora, quien);
      // Lo que tardó cada plato, para el informe de tiempos de cocina.
      for (const l of estado.cuentas.find((c) => c.id === cuenta.id)!.lineas) {
        const tarda =
          (l.destino === "cocina" ? 8 : 2) + Math.floor(azar() * (l.destino === "cocina" ? 14 : 5));
        apuntarTiempos(estado, [l], new Date(hora.getTime() + tarda * 60_000).toISOString());
      }
      // De vez en cuando se invita a algo o se cae un plato.
      const lineasAhora = estado.cuentas.find((c) => c.id === cuenta.id)!.lineas;
      const primera = lineasAhora[0]!;
      const suerte = azar();
      if (suerte < 0.06)
        hacer(
          { tipo: "invitar_linea", cuentaId: cuenta.id, lineaId: primera.id, invitacion: true },
          hora,
          quien,
        );
      else if (suerte < 0.09 && lineasAhora.length > 1)
        hacer(
          { tipo: "anular_linea", cuentaId: cuenta.id, lineaId: primera.id, motivo: "Se ha caído" },
          hora,
          quien,
        );
      const conTarjeta = azar() < 0.62;
      const total = totalCuenta(estado.cuentas.find((c) => c.id === cuenta.id)!);
      const entregado = conTarjeta ? total : Math.ceil(total / 500) * 500;
      if (!conTarjeta) efectivo += total;
      const cobro = new Date(hora.getTime() + 40 * 60_000);
      hacer(
        {
          tipo: "cobrar",
          cuentaId: cuenta.id,
          pagos: [{ metodo: conTarjeta ? "tarjeta" : "efectivo", importe: entregado }],
        },
        cobro,
        quien,
      );
    }
    const descuadre = azar() < 0.2 ? -Math.round(azar() * 500) : 0;
    hacer({ tipo: "cerrar_caja", efectivoContado: efectivo + descuadre }, a(23, 30));
  }

  const gastos: [number, string, AccionGasto["categoria"], string, number, number][] = [
    [13, "Barriles de cerveza", "proveedores", "Distribuciones Ficticias", 48000, 21],
    [12, "Pescado y marisco", "proveedores", "Lonja Inventada", 21500, 10],
    [10, "Verdura y fruta", "proveedores", "Huerta Ejemplo", 9800, 4],
    [9, "Factura de la luz", "suministros", "Eléctrica Ficticia", 31200, 21],
    [7, "Carne", "proveedores", "Carnicería Ejemplo", 26400, 10],
    [6, "Reparación cafetera", "mantenimiento", "Servicio Técnico Ejemplo", 9500, 21],
    [5, "Vinos", "proveedores", "Bodegas Inventadas", 33600, 21],
    [3, "Alquiler del local", "alquiler", "Inmobiliaria Ficticia", 150000, 21],
    [2, "Pan del día (semana)", "proveedores", "Panadería Ejemplo", 4200, 4],
    [1, "Agua y gas", "suministros", "Compañía Ficticia", 8900, 21],
  ];
  for (const [diasAtras, concepto, categoria, proveedor, importe, iva] of gastos) {
    const fecha = new Date(hoy);
    fecha.setUTCDate(fecha.getUTCDate() - diasAtras);
    fecha.setUTCHours(9, 0, 0, 0);
    hacer(
      {
        tipo: "guardar_gasto",
        gasto: {
          fecha: fecha.toISOString(),
          concepto,
          categoria,
          proveedor,
          importe,
          iva,
          metodo: "tarjeta",
          deCaja: false,
        },
      },
      fecha,
    );
  }

  // Hoy: un par de mesas en marcha para que la sala no esté vacía.
  const ahora = new Date(ctx.ahora);
  const luis = camareros[0] ?? ana;
  const m1 = estado.mesas.find((m) => m.nombre === "Mesa 2")!;
  hacer({ tipo: "abrir_cuenta", mesaId: m1.id, comensales: 3 }, ahora, luis);
  const c1 = cuentaDeMesa(estado, m1.id)!;
  hacer(
    {
      tipo: "anotar",
      cuentaId: c1.id,
      lineas: [
        { productoId: "prod-1-1", cantidad: 2, opciones: [], nota: "" },
        { productoId: "prod-2-5", cantidad: 1, opciones: [], nota: "" },
        { productoId: "prod-5-1", cantidad: 1, opciones: [], nota: "" },
        { productoId: "prod-5-2", cantidad: 1, opciones: [], nota: "Poco picante" },
      ],
    },
    ahora,
    luis,
  );
  hacer({ tipo: "enviar_comanda", cuentaId: c1.id }, ahora, luis);
  const t3 = estado.mesas.find((m) => m.nombre === "Terraza 3")!;
  hacer({ tipo: "abrir_cuenta", mesaId: t3.id, comensales: 2 }, ahora, luis);
  const c2 = cuentaDeMesa(estado, t3.id)!;
  hacer(
    {
      tipo: "anotar",
      cuentaId: c2.id,
      lineas: [{ productoId: "prod-4-3", cantidad: 2, opciones: [], nota: "" }],
    },
    ahora,
    luis,
  );
  hacer({ tipo: "enviar_comanda", cuentaId: c2.id }, ahora, luis);

  // Los trabajos de impresión del historial no interesan: se empieza con la cola limpia.
  estado.trabajos = [];
  return estado;
}

/** Un par de reservas para esta noche (nombres y teléfonos inventados). */
function reservasDeEjemplo(ahora: string, mesas: Mesa[]): Reserva[] {
  const hoy = diaLocal(ahora);
  const mesa = (nombre: string) => mesas.find((m) => m.nombre === nombre)?.id ?? null;
  const base = { nota: "", creadaEn: ahora };
  return [
    {
      ...base,
      id: "res-1",
      nombre: "Familia Ejemplo",
      telefono: "600 000 001",
      personas: 4,
      dia: hoy,
      hora: "21:00",
      mesaId: mesa("Mesa 4"),
      estado: "confirmada",
      online: false,
      nota: "Traen una trona",
    },
    {
      ...base,
      id: "res-2",
      nombre: "Paula Inventada",
      telefono: "600 000 002",
      personas: 2,
      dia: hoy,
      hora: "21:30",
      mesaId: null,
      estado: "por_confirmar",
      online: true,
    },
  ];
}

type AccionGasto = Extract<AccionPersonal, { tipo: "guardar_gasto" }>["gasto"];
