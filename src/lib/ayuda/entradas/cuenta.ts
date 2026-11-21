import type { EntradaAyuda } from "../tipos";

/** La cuenta del dueño, entrar en un aparato y lo que hace el cliente con el QR. */
export const CUENTA: EntradaAyuda[] = [
  {
    id: "alta-bar",
    titulo: "Dar de alta un bar nuevo",
    preguntas: [
      "crear un bar",
      "empezar con comanda",
      "registrarme",
      "nuevo local",
      "abrir otro bar",
    ],
    pasos: [
      "En la web, «Da de alta tu bar»: crea tu cuenta con tu correo y una contraseña.",
      "En «Mis bares», rellena «Nombre del bar», «Tu nombre» y «Tu PIN (4 a 6 cifras)».",
      "Si quieres, «Empezar con una carta de ejemplo» para cambiar precios en vez de empezar de cero.",
      "Pulsa «Crear el bar»: este aparato queda listo para entrar con tu PIN.",
    ],
    ruta: "/mis-bares",
    captura: false, // Solo con la cuenta en la nube: no sale en las capturas.
    quien: "encargado",
    apis: ["/api/dueno", "/api/locales"],
    pantallas: ["/registro", "/mis-bares"],
    ver: ["resumen"],
  },
  {
    id: "varios-bares",
    titulo: "Llevar varios bares con la misma cuenta",
    preguntas: ["otro bar", "segundo local", "cambiar de bar", "mis bares"],
    pasos: [
      "Entra con tu cuenta y ve a «Mis bares».",
      "«Dar de alta otro bar» crea uno nuevo; «Usar en este aparato» cambia de bar.",
      "Cada bar lleva su carta, su equipo, sus tickets y su caja por separado.",
    ],
    ruta: "/mis-bares",
    captura: false, // Solo con la cuenta en la nube: no sale en las capturas.
    quien: "encargado",
    apis: ["/api/locales"],
  },
  {
    id: "entrar-cuenta",
    titulo: "Entrar con la cuenta del dueño",
    preguntas: ["iniciar sesión", "entrar con mi correo", "login", "acceder"],
    pasos: [
      "En la pantalla de entrar, pulsa «Entra con tu cuenta» y pon tu correo y tu contraseña.",
    ],
    ruta: "/acceder",
    captura: false, // Solo con la cuenta en la nube: no sale en las capturas.
    quien: "encargado",
    apis: ["/api/dueno"],
    pantallas: ["/acceder"],
  },
  {
    id: "olvide-clave",
    titulo: "He olvidado la contraseña de la cuenta",
    preguntas: [
      "olvidé la contraseña",
      "cambiar contraseña",
      "recuperar cuenta",
      "no puedo entrar",
    ],
    pasos: [
      "En «Entra con tu cuenta», pulsa «He olvidado la contraseña» y pon tu correo.",
      "Abre el enlace del correo y escribe la «Contraseña nueva» (al menos 8 caracteres).",
      "Pulsa «Guardar contraseña» y «Entra con ella».",
    ],
    ruta: "/acceder",
    captura: false, // Solo con la cuenta en la nube: no sale en las capturas.
    quien: "encargado",
    apis: ["/api/dueno"],
    pantallas: ["/acceder/nueva-clave"],
  },
  {
    id: "entrar-pin",
    titulo: "Entrar con el PIN y salir",
    preguntas: ["entrar con pin", "olvidé mi pin", "cambiar de camarero", "salir", "cerrar sesión"],
    pasos: [
      "En un aparato ya vinculado, escribe tu PIN y pulsa «Entrar».",
      "Para que entre otra persona, pulsa «Salir» arriba.",
      "Si no recuerdas tu PIN, el encargado lo cambia en Gestión → Equipo.",
    ],
    ruta: "/entrar",
    quien: "equipo",
    apis: ["/api/sesion"],
    nota: "Tras varios PIN fallidos seguidos se bloquea unos minutos, por seguridad.",
  },
  {
    id: "panel-comanda",
    titulo: "Panel de Comanda (para quien vende el programa)",
    preguntas: ["panel de administración", "todos los bares", "admin"],
    pasos: [
      "Con una cuenta de administración, «Mis bares» → «Panel de Comanda» lista todos los bares, de quién son y si se usan.",
    ],
    ruta: "/admin",
    captura: false, // Solo con la cuenta en la nube: no sale en las capturas.
    quien: "encargado",
    pantallas: ["/admin"],
  },
  {
    id: "legal-plataforma",
    titulo: "Aviso legal, privacidad y declaración responsable de Comanda",
    preguntas: ["aviso legal", "privacidad de comanda", "condiciones", "declaración responsable"],
    pasos: [
      "El aviso legal y la privacidad de la plataforma están en «Aviso legal y privacidad», al pie de la web.",
      "La declaración responsable del sistema de facturación está en Gestión → VERI*FACTU.",
    ],
    ruta: "/legal",
    quien: "encargado",
    apis: ["/api/declaracion"],
    pantallas: ["/legal"],
  },

  // Lo que hace el cliente con el QR
  {
    id: "cliente-pide",
    titulo: "Cómo pide el cliente desde el QR de la mesa",
    preguntas: [
      "cliente pide desde el móvil",
      "carta qr",
      "qué ve el cliente",
      "pedir desde la mesa",
    ],
    pasos: [
      "El cliente escanea el QR de la mesa: ve la carta (con «Lo más pedido» arriba y las cartas que toquen).",
      "Añade productos, revisa su pedido y lo manda.",
      "Si el bar lo pide, un camarero lo acepta antes de que vaya a cocina.",
    ],
    quien: "equipo",
    apis: ["/api/mesa/[local]/[token]"],
    acciones: ["pedir"],
  },
  {
    id: "cliente-llama",
    titulo: "Cuando el cliente llama al camarero o pide la cuenta desde el QR",
    preguntas: ["llamar al camarero", "pedir la cuenta desde el móvil", "botón de la mesa"],
    pasos: [
      "Desde la carta QR, el cliente puede «llamar al camarero» o «pedir la cuenta».",
      "Os sale en «Sala» → «Avisos» (y el móvil vibra). Al atenderlo, «Hecho».",
    ],
    ruta: "/sala",
    quien: "equipo",
    acciones: ["llamar_camarero", "pedir_cuenta"],
  },
];
