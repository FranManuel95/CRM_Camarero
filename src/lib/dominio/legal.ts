import type { Ajustes } from "./tipos";
import type { Funcion } from "./funciones";

/**
 * Textos legales que se enseñan al público: los de cada bar (aviso legal, privacidad y cookies de
 * su carta QR, reservas, pedidos y club) y los de la plataforma. Solo dicen lo que la app hace de
 * verdad: si una función está apagada, su apartado no sale.
 *
 * Son una base razonable (RGPD art. 13, LOPDGDD y LSSI arts. 10 y 22), no asesoramiento legal.
 */

export type Seccion = { id: string; titulo: string; parrafos: string[] };
export type TextoLegal = { titular: string; secciones: Seccion[]; faltan: string[] };

export type Prestador = { nombre: string; nif: string; correo?: string };

/** Quién presta el servicio informático (encargado del tratamiento del bar). */
export function prestadorDe(entorno: Record<string, string | undefined>): Prestador | null {
  const nombre = entorno.LEGAL_TITULAR_NOMBRE || entorno.VERIFACTU_PRODUCTOR_NOMBRE;
  const nif = entorno.LEGAL_TITULAR_NIF || entorno.VERIFACTU_PRODUCTOR_NIF;
  if (!nombre || !nif) return null;
  return { nombre, nif, correo: entorno.LEGAL_TITULAR_CORREO || undefined };
}

const SUBENCARGADOS =
  "Vercel Inc. (alojamiento de la web; transferencias a EE. UU. amparadas por el Marco de " +
  "Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo) y Supabase Inc. (base de " +
  "datos, en servidores de la Unión Europea)";

function contactoDe(a: Ajustes) {
  return [
    a.correoContacto && `escribiendo a ${a.correoContacto}`,
    a.telefono && `llamando al ${a.telefono}`,
    a.direccion && `por carta o en persona en ${a.direccion}`,
  ].filter(Boolean) as string[];
}

function enumerar(cosas: string[]) {
  if (cosas.length <= 1) return cosas.join("");
  return `${cosas.slice(0, -1).join(", ")} o ${cosas.at(-1)}`;
}

/** Aviso legal, privacidad y cookies de las páginas públicas de un bar. */
export function legalDelBar(
  a: Ajustes,
  activa: (f: Funcion) => boolean,
  prestador: Prestador | null,
  conCorreo: boolean,
): TextoLegal {
  const titular = a.razonSocial || a.nombreLocal;
  const faltan = [
    !a.razonSocial && "la razón social",
    !a.nif && "el NIF",
    !a.direccion && "la dirección",
    !a.correoContacto && "un correo de contacto",
  ].filter(Boolean) as string[];
  const contacto = contactoDe(a);
  const comoContactar = contacto.length ? enumerar(contacto) : "preguntando en el propio local";

  const identidad = [
    `Titular: ${titular}${a.nif ? `, con NIF ${a.nif}` : ""}.`,
    a.nombreLocal !== titular ? `Nombre comercial: ${a.nombreLocal}.` : "",
    a.direccion ? `Domicilio: ${a.direccion}.` : "",
    [a.telefono && `teléfono ${a.telefono}`, a.correoContacto && `correo ${a.correoContacto}`]
      .filter(Boolean)
      .join(" y ")
      .replace(/^./, (c) => c.toUpperCase())
      .concat(a.telefono || a.correoContacto ? "." : ""),
  ].filter(Boolean);

  // Qué datos se recogen, para qué y con qué base, según las funciones encendidas.
  const usos: string[] = [];
  if (activa("reservas") && activa("reservasOnline"))
    usos.push(
      "Reservas: tu nombre, tu teléfono, el día, la hora, las personas y la nota que dejes, " +
        "para guardarte la mesa y avisarte si hay algún cambio. Base: tu petición (art. 6.1.b " +
        "RGPD). Se borran a los 90 días de la fecha de la reserva.",
    );
  if (activa("paraLlevar") && activa("pedidosOnline"))
    usos.push(
      "Pedidos para llevar: tu nombre, tu teléfono y lo que pides, para prepararlo y avisarte. " +
        "Base: tu pedido (art. 6.1.b RGPD). Se borran dos días después de recogerlo; el ticket, " +
        "que lleva tu nombre, se guarda por obligación fiscal.",
    );
  if (activa("club"))
    usos.push(
      "Club de clientes: tu nombre, tu teléfono, tu correo si lo das y lo que consumes, para " +
        "darte puntos y descuentos. Base: tu consentimiento (art. 6.1.a RGPD), que puedes " +
        "retirar cuando quieras; entonces se borra tu ficha (tu nombre sigue en los tickets ya " +
        "hechos, que se guardan por obligación fiscal). Las ofertas por correo o mensaje, solo " +
        "si marcas la casilla.",
    );
  if (activa("fiado"))
    usos.push(
      "Cuentas pendientes de pago: tu nombre y lo que debes, para cobrarlo más tarde. Base: el " +
        "contrato (art. 6.1.b RGPD). Se guardan hasta que se salda la cuenta.",
    );
  if (activa("ticketCorreo") && conCorreo)
    usos.push(
      "Ticket por correo: tu dirección de correo, solo para mandarte el ticket. No se guarda " +
        "después del envío.",
    );
  usos.push(
    "Pedidos desde la mesa con la carta QR: no se piden datos personales. El ticket de lo que " +
      "consumes se conserva el tiempo que exige la ley fiscal (normalmente cuatro años).",
  );

  const secciones: Seccion[] = [
    {
      id: "aviso-legal",
      titulo: "Aviso legal",
      parrafos: [
        "Estas páginas (carta, pedidos, reservas y club) son de este establecimiento, que es " +
          "responsable de su contenido.",
        ...identidad,
        "Precios con IVA incluido. Las fotos de los platos son orientativas.",
      ],
    },
    {
      id: "privacidad",
      titulo: "Privacidad",
      parrafos: [
        `Responsable de tus datos: ${titular}${a.nif ? ` (NIF ${a.nif})` : ""}. Puedes ` +
          `contactar ${comoContactar}.`,
        "Qué datos usamos y para qué:",
        ...usos.map((u) => `• ${u}`),
        "No usamos tus datos para decisiones automatizadas ni elaboramos perfiles, y no se los " +
          "damos a nadie salvo obligación legal (por ejemplo, a Hacienda).",
        `Para funcionar, el establecimiento usa un programa en la nube${
          prestador ? ` de ${prestador.nombre} (NIF ${prestador.nif})` : ""
        }, que trata los datos solo por cuenta del establecimiento y con contrato de encargo ` +
          `(art. 28 RGPD), y que a su vez se apoya en ${SUBENCARGADOS}.`,
        `Tus derechos: puedes pedir ver tus datos, corregirlos, borrarlos, limitarlos, ` +
          `oponerte o llevártelos, ${comoContactar}. Si crees que no se han respetado, puedes ` +
          `reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
      ],
    },
    {
      id: "cookies",
      titulo: "Cookies",
      parrafos: [
        "Estas páginas no usan cookies de publicidad ni de analítica. Solo guardan en tu móvil " +
          "lo imprescindible para funcionar (por ejemplo, tu tarjeta del club o la mesa en la " +
          "que estás), y por eso no hace falta pedirte permiso (art. 22.2 LSSI).",
      ],
    },
  ];
  return { titular, secciones, faltan };
}

/** Aviso legal y privacidad de la propia plataforma (cuentas de dueño). */
export function legalDePlataforma(prestador: Prestador | null, web: string): TextoLegal {
  const titular = prestador?.nombre ?? "El titular de Comanda";
  const faltan = [
    !prestador && "LEGAL_TITULAR_NOMBRE y LEGAL_TITULAR_NIF",
    !prestador?.correo && "LEGAL_TITULAR_CORREO",
  ].filter(Boolean) as string[];
  const contacto = prestador?.correo ? `escribiendo a ${prestador.correo}` : "por correo";
  return {
    titular,
    faltan,
    secciones: [
      {
        id: "aviso-legal",
        titulo: "Aviso legal",
        parrafos: [
          `${web} es un programa para la gestión de bares (TPV, carta QR, reservas y caja).`,
          `Titular: ${titular}${prestador ? `, con NIF ${prestador.nif}` : ""}.`,
          ...(prestador?.correo ? [`Contacto: ${prestador.correo}.`] : []),
          "Las páginas de cada bar (su carta, reservas y club) son responsabilidad de ese bar, " +
            "que tiene su propio aviso legal y su privacidad.",
        ],
      },
      {
        id: "privacidad",
        titulo: "Privacidad",
        parrafos: [
          `Responsable de los datos de las cuentas de dueño: ${titular}. Contacto: ${contacto}.`,
          "• Cuenta: tu correo y tu contraseña (que no vemos: se guarda cifrada), para que " +
            "puedas entrar y gestionar tus bares. Base: el contrato (art. 6.1.b RGPD). Se " +
            "guardan mientras tengas la cuenta.",
          "• Al elegir contraseña, comprobamos que no aparezca en filtraciones conocidas " +
            "consultando Pwned Passwords sin mandar la contraseña (solo un fragmento de su " +
            "huella).",
          "• Registros técnicos (errores y tiempos), sin datos personales, para que el " +
            "servicio funcione y sea seguro. Base: interés legítimo (art. 6.1.f RGPD).",
          "Los datos de los clientes y del equipo de cada bar son del bar: los tratamos solo por " +
            "su cuenta, según el contrato de encargo de tratamiento (art. 28 RGPD).",
          `Proveedores: ${SUBENCARGADOS}. Para el correo, Resend Inc. (EE. UU., con las mismas ` +
            "garantías). Si el bar usa la lectura de facturas o de la carta con IA, esas fotos " +
            "se mandan al proveedor de IA configurado solo para leerlas.",
          `Tus derechos: acceso, rectificación, supresión, limitación, oposición y ` +
            `portabilidad, ${contacto}. Puedes reclamar ante la AEPD (aepd.es).`,
        ],
      },
      {
        id: "cookies",
        titulo: "Cookies",
        parrafos: [
          "Solo usamos cookies técnicas, imprescindibles para mantener tu sesión y la del " +
            "aparato del bar. No hay cookies de publicidad ni de analítica, así que no hace " +
            "falta pedirte permiso (art. 22.2 LSSI).",
        ],
      },
    ],
  };
}
