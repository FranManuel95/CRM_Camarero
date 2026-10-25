import type { Estado } from "./tipos";

/** Lo que le falta a un bar para estar listo: la lista de primeros pasos de Gestión. */
export function primerosPasos(
  estado: Pick<
    Estado,
    "ajustes" | "productos" | "mesas" | "empleados" | "impresoras" | "tickets" | "trabajos"
  >,
) {
  return [
    {
      clave: "ticket",
      texto: "Pon el NIF y la dirección que salen en el ticket",
      enlace: "/gestion/ajustes",
      hecho: Boolean(estado.ajustes.nif && estado.ajustes.direccion),
    },
    {
      clave: "carta",
      texto: "Prepara tu carta con tus precios",
      enlace: "/gestion/carta",
      hecho: estado.productos.length >= 5,
    },
    {
      clave: "mesas",
      texto: "Coloca tus mesas en el plano",
      enlace: "/gestion/mesas",
      hecho: estado.mesas.length > 0,
    },
    {
      clave: "equipo",
      texto: "Da de alta a tu equipo con su PIN",
      enlace: "/gestion/equipo",
      hecho: estado.empleados.filter((e) => e.activo).length >= 2,
    },
    {
      clave: "impresora",
      texto: "Prueba tu impresora",
      enlace: "/gestion/impresoras",
      hecho: estado.trabajos.some((t) => t.tipo === "prueba" && t.estado === "impreso"),
    },
    {
      clave: "cobro",
      texto: "Haz tu primer cobro",
      enlace: "/sala",
      hecho: estado.tickets.length > 0,
    },
  ];
}
