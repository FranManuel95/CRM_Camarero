import { totalCuenta } from "./importes";
import type { ClienteClub, Cuenta, Estado, ReglasClub, Ticket } from "./tipos";

/**
 * Club de clientes: puntos por lo que gastan y un premio (descuento) cuando llegan a la cifra.
 * Lo justo para fidelizar sin complicar el cobro.
 */

export const REGLAS_CLUB: ReglasClub = {
  puntosPorEuro: 1,
  puntosPremio: 100,
  valorPremio: 500,
  bienvenida: 10,
};

export const reglasClub = (estado: Pick<Estado, "ajustes">): ReglasClub => ({
  ...REGLAS_CLUB,
  ...estado.ajustes.club,
});

/** Puntos que da una compra (por euros enteros). */
export function puntosDeCompra(total: number, reglas: ReglasClub): number {
  return Math.max(0, Math.floor((total / 100) * reglas.puntosPorEuro));
}

const MAX_HISTORIAL = 30;
const MAX_FAVORITOS = 12;

/** Apunta una compra en la ficha del cliente: puntos, visita, gasto y lo que ha pedido. */
export function apuntarCompra(
  cliente: ClienteClub,
  ticket: Pick<Ticket, "numero" | "fecha" | "total" | "lineas">,
  reglas: ReglasClub,
  esVisita: boolean,
): number {
  const puntos = puntosDeCompra(ticket.total, reglas);
  cliente.puntos += puntos;
  cliente.gastado += ticket.total;
  if (esVisita) {
    cliente.visitas += 1;
    cliente.ultimaVisita = ticket.fecha;
  }
  for (const l of ticket.lineas)
    cliente.favoritos[l.producto] = (cliente.favoritos[l.producto] ?? 0) + l.cantidad;
  cliente.favoritos = Object.fromEntries(
    Object.entries(cliente.favoritos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_FAVORITOS),
  );
  cliente.historial.unshift({
    fecha: ticket.fecha,
    ticket: ticket.numero,
    total: ticket.total,
    puntos,
  });
  cliente.historial.splice(MAX_HISTORIAL);
  return puntos;
}

/** ¿Puede canjear el premio en esta cuenta? */
export function puedeCanjear(
  cliente: ClienteClub | undefined,
  cuenta: Cuenta,
  reglas: ReglasClub,
): boolean {
  return Boolean(
    cliente &&
      !cuenta.canje &&
      cliente.puntos >= reglas.puntosPremio &&
      totalCuenta(cuenta) >= reglas.valorPremio,
  );
}

/** Busca por nombre, teléfono (sin espacios) o código de tarjeta. */
export function buscarClientes(clientes: ClienteClub[], texto: string): ClienteClub[] {
  const t = texto.trim().toLowerCase();
  if (!t) return [];
  const digitos = t.replace(/\s/g, "");
  return clientes
    .filter(
      (c) =>
        c.nombre.toLowerCase().includes(t) ||
        (t.length >= 4 && c.codigo.toLowerCase().startsWith(t)) ||
        (digitos.length >= 3 && c.telefono.replace(/\s/g, "").includes(digitos)),
    )
    .slice(0, 20);
}

/** Teléfono para comparar: sin espacios ni prefijo de España. */
export const telefonoLimpio = (t: string) => t.replace(/\s/g, "").replace(/^(\+34|0034)/, "");

/** Números del club: altas, los que repiten y los que hace tiempo que no vienen. */
export function resumenClub(clientes: ClienteClub[], ahora: string) {
  const dias = (n: number) => new Date(Date.parse(ahora) - n * 86_400_000).toISOString();
  const hace30 = dias(30);
  const hace60 = dias(60);
  return {
    total: clientes.length,
    nuevos: clientes.filter((c) => c.altaEn >= hace30).length,
    repiten: clientes.filter((c) => c.visitas >= 2).length,
    dormidos: clientes.filter((c) => c.ultimaVisita && c.ultimaVisita < hace60).length,
    conOfertas: clientes.filter((c) => c.comunicaciones).length,
    gastoMedio: clientes.length
      ? Math.round(clientes.reduce((s, c) => s + c.gastado, 0) / clientes.length)
      : 0,
  };
}
