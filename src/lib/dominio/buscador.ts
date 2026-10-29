import { activa } from "./funciones";
import { euros } from "./importes";
import { cuentaDeMesa } from "./reducir";
import { telefonoLimpio } from "./club";
import type { Estado, Ticket } from "./tipos";

export type Resultado = {
  clave: string;
  grupo: "Secciones" | "Carta" | "Tickets" | "Clientes" | "Mesas" | "Equipo" | "Gastos" | "Stock";
  texto: string;
  detalle: string;
  /** A dónde lleva. Los tickets no llevan enlace: se abren en el mismo buscador. */
  enlace?: string;
  ticket?: Ticket;
};

/** Palabras con las que se busca cada sección («¿dónde se cambia el NIF?»). */
const SECCIONES: { texto: string; enlace: string; palabras: string }[] = [
  {
    texto: "Ajustes",
    enlace: "/gestion/ajustes",
    palabras: "datos fiscales nif razon social direccion pie ticket qr copia seguridad",
  },
  {
    texto: "Funciones",
    enlace: "/gestion/funciones",
    palabras: "encender apagar activar reservas club fiado stock",
  },
  {
    texto: "Impresoras",
    enlace: "/gestion/impresoras",
    palabras: "impresora cajon papel ticket comanda",
  },
  {
    texto: "Informes",
    enlace: "/gestion/informes",
    palabras: "ventas iva propinas reparto camarero tiempos cocina excel csv gestoria",
  },
  { texto: "Gastos", enlace: "/gestion/gastos", palabras: "factura proveedor luz alquiler compra" },
  {
    texto: "Carta",
    enlace: "/gestion/carta",
    palabras: "productos precios alergenos menu del dia happy hour tarifas subir precios",
  },
  {
    texto: "Mesas y QR",
    enlace: "/gestion/mesas",
    palabras: "plano zona qr decoracion distribucion sin ticket",
  },
  {
    texto: "Equipo",
    enlace: "/gestion/equipo",
    palabras: "camarero pin permisos fichajes turnos cuadrante vincular movil",
  },
  { texto: "Clientes", enlace: "/gestion/clientes", palabras: "club puntos deuda fiado" },
  { texto: "Reseñas", enlace: "/gestion/resenas", palabras: "google opiniones cartel" },
  { texto: "Caja", enlace: "/caja", palabras: "cierre z arqueo cajon fondo descuadre" },
  { texto: "Historial", enlace: "/gestion/historial", palabras: "quien cambios anulaciones" },
];

/** Sin tildes ni mayúsculas, para que «cana» encuentre «Caña». */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Busca en todo Gestión: carta, tickets, clientes, mesas, equipo, gastos, stock y secciones. */
export function buscarEnGestion(estado: Estado, consulta: string, maximo = 30): Resultado[] {
  const q = normalizar(consulta);
  if (q.length < 2) return [];
  const tiene = (...textos: (string | undefined)[]) =>
    textos.some((t) => t && normalizar(t).includes(q));
  const r: Resultado[] = [];

  for (const s of SECCIONES)
    if (tiene(s.texto, s.palabras))
      r.push({
        clave: `s-${s.enlace}`,
        grupo: "Secciones",
        texto: s.texto,
        detalle: "Ir a la sección",
        enlace: s.enlace,
      });

  for (const p of estado.productos)
    if (tiene(p.nombre, p.nombreEn))
      r.push({
        clave: `p-${p.id}`,
        grupo: "Carta",
        texto: p.nombre,
        detalle: `${euros(p.precio)} · ${estado.categorias.find((c) => c.id === p.categoriaId)?.nombre ?? ""}${p.oculto ? " · oculto" : !p.disponible ? " · agotado" : ""}`,
        enlace: `/gestion/carta?producto=${p.id}`,
      });

  // Tickets: por número («145», «T2026-000145») o por mesa. Los más nuevos primero.
  const numero = /^\d+$/.test(q) ? Number(q) : null;
  for (const t of [...estado.tickets].reverse())
    if (
      (numero !== null && t.secuencia === numero) ||
      tiene(t.numero) ||
      (numero === null && tiene(t.mesaNombre))
    )
      r.push({
        clave: `t-${t.id}`,
        grupo: "Tickets",
        texto: `Ticket ${t.numero}`,
        detalle: `${t.mesaNombre} · ${euros(t.total)} · ${new Date(t.fecha).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}`,
        ticket: t,
      });

  if (activa(estado.ajustes, "club")) {
    const digitos = /^\+?[\d\s]+$/.test(consulta.trim()) ? telefonoLimpio(consulta.trim()) : "";
    for (const c of estado.clientes)
      if (tiene(c.nombre) || (digitos.length >= 3 && telefonoLimpio(c.telefono).includes(digitos)))
        r.push({
          clave: `c-${c.id}`,
          grupo: "Clientes",
          texto: c.nombre,
          detalle: `${c.puntos} puntos · ${c.visitas} visitas${c.deuda ? ` · debe ${euros(c.deuda)}` : ""}`,
          enlace: `/gestion/clientes?cliente=${c.id}`,
        });
  }

  for (const m of estado.mesas)
    if (tiene(m.nombre)) {
      const abierta = cuentaDeMesa(estado, m.id);
      r.push({
        clave: `m-${m.id}`,
        grupo: "Mesas",
        texto: m.nombre,
        detalle: abierta
          ? "Abierta ahora"
          : `${m.plazas} plazas · ${estado.zonas.find((z) => z.id === m.zonaId)?.nombre ?? ""}`,
        enlace: abierta ? `/sala/${m.id}` : "/gestion/mesas",
      });
    }

  for (const e of estado.empleados)
    if (tiene(e.nombre))
      r.push({
        clave: `e-${e.id}`,
        grupo: "Equipo",
        texto: e.nombre,
        detalle: `${e.rol === "encargado" ? "Encargado" : "Camarero"}${e.activo ? "" : " · desactivado"}`,
        enlace: "/gestion/equipo",
      });

  for (const g of [...estado.gastos].reverse())
    if (tiene(g.concepto, g.proveedor))
      r.push({
        clave: `g-${g.id}`,
        grupo: "Gastos",
        texto: g.concepto,
        detalle: `${g.proveedor ? `${g.proveedor} · ` : ""}${euros(g.importe)}`,
        enlace: "/gestion/gastos",
      });

  if (activa(estado.ajustes, "stock"))
    for (const i of estado.ingredientes)
      if (tiene(i.nombre, i.proveedor))
        r.push({
          clave: `i-${i.id}`,
          grupo: "Stock",
          texto: i.nombre,
          detalle: `Quedan ${Math.round(i.existencias * 100) / 100} ${i.unidad}`,
          enlace: "/gestion/stock",
        });

  return r.slice(0, maximo);
}
