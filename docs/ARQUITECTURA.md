# Arquitectura

## La idea

Un **servidor en el ordenador del bar** (el de la caja) guarda todo y lo reparte por la wifi del
local a todas las pantallas: la caja, los móviles o PDAs de los camareros, la pantalla de cocina y
los móviles de los clientes que escanean el QR. Si se cae internet, el bar sigue funcionando: solo
necesita la wifi del local. Las impresoras de red reciben las comandas directamente del servidor.

```
 Móvil del cliente ──QR──┐
 PDA del camarero ───────┤  wifi del local   ┌──────────────────────────────┐   puerto 9100
 Pantalla de cocina ─────┼──────────────────▶│ Ordenador de la caja         │──────────────▶ Impresora cocina
 Caja (TPV táctil) ──────┘   (eventos SSE)   │ next start · datos/estado.json│──────────────▶ Impresora tickets ─ cajón
                                             └──────────────────────────────┘
```

## Las dos formas de tenerlo

|                    | En el ordenador del bar       | En la nube                                                                                     |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Dónde se guarda    | `datos/estado.json`           | Supabase (proyecto `comanda-tpv`, París)                                                       |
| Se activa con      | Nada (es lo de por defecto)   | `TPV_CLAVE` + `NEXT_PUBLIC_SUPABASE_*`                                                         |
| Cambios en directo | Flujo SSE del propio servidor | Supabase Realtime (solo avisa «hay cambios»; la pantalla pide los datos a la app)              |
| Impresoras de red  | Las atiende el servidor       | Las atiende el **puente de impresión** (`public/puente-impresion.mjs`) en un ordenador del bar |
| Sin internet       | Sigue funcionando             | No funciona                                                                                    |

### Varios bares (fase 1)

- Cada bar es una fila de `public.locales` (identificador tipo `bar-paco`, dueño de
  `auth.users`). Su estado y sus tickets van aparte, y su canal de Realtime es `tpv:<bar>`.
- La app tiene una sola **clave de servidor** (`TPV_CLAVE`); en la base de datos está su SHA-256
  en `privado.servidor`. Quién puede tocar cada bar lo decide la app:
  - **Dueño**: cuenta de Supabase Auth (correo y contraseña). Al entrar, la app guarda una cookie
    firmada con su id; con ella da de alta bares y vincula aparatos.
  - **Aparato**: cookie firmada con el bar al que está vinculado (un año). Se vincula desde la
    cuenta del dueño o con un código de 6 cifras de un solo uso que saca el encargado (15 min).
  - **Empleado**: PIN dentro del bar del aparato; la sesión lleva el bar y el empleado.
  - **Cliente**: la dirección del QR lleva el bar y el token de la mesa: `/m/<bar>/<token>`.
- El puente de impresión usa una clave `«bar».«firma»` que sale del secreto del servidor.
- `ADMIN_EMAILS`: correos que ven el Panel de Comanda (`/admin`).

### En la nube, por dentro

- Tablas `locales`, `estados` (un documento con lo vivo del local y un número de revisión) y
  `tickets` (una fila por ticket, solo se pueden añadir). Todas con RLS y sin políticas: nadie las
  lee desde fuera. Ver `supabase/migrations/`.
- La app (Vercel) entra por dos funciones, `tpv_cargar` y `tpv_guardar`, que piden la **clave del
  local**; en la base de datos solo está su resumen SHA-256, en un esquema que no sale en la API.
- Cada acción: leer estado y revisión → aplicar con `reducir` → guardar solo si la revisión no ha
  cambiado (si otra pantalla se adelantó, se repite). Estado y tickets nuevos se guardan en la
  misma transacción, y entonces Supabase avisa por Realtime al canal `tpv:<local>`.
- Los avisos de seguridad de Supabase «funciones SECURITY DEFINER ejecutables por anon» son
  intencionados: sin la clave del local no hacen nada.

## Cómo fluye un cambio

1. Una pantalla manda una **acción** (`src/lib/dominio/acciones.ts`, validada con Zod): «anotar dos
   cañas en la mesa 4», «cobrar con tarjeta», «el cliente pide la cuenta»…
2. El servidor comprueba quién la manda (PIN del camarero o QR de la mesa) y la aplica con
   `reducir` (`src/lib/dominio/reducir.ts`): una función pura, sin React ni red, con pruebas.
3. Si toca imprimir, `reducir` devuelve los **trabajos de impresión** (documentos en
   `src/lib/impresion/`) y el servidor los manda a las impresoras de red.
4. El estado nuevo se guarda en `datos/estado.json` (escritura atómica) y se manda a todas las
   pantallas por **Server-Sent Events** (`/api/eventos` y `/api/mesa/[token]/eventos`).

Los clientes solo ven su mesa y la carta (`vistaCliente`); el personal no recibe los PIN
(`vistaPersonal`).

## Rutas

| Ruta                               | Para quién                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `/`                                | Portada con las pantallas                                                             |
| `/entrar`                          | PIN del personal                                                                      |
| `/sala`, `/sala/[mesaId]`          | Camarero: plano, avisos, comanda y cobro                                              |
| `/cocina`, `/cocina?destino=barra` | Pantalla de cocina y de barra                                                         |
| `/caja`                            | Apertura, tickets del turno, movimientos y cierre Z                                   |
| `/gestion/*`                       | Encargado: resumen, informes, gastos, carta, mesas y QR, equipo, impresoras y ajustes |
| `/m/[token]`                       | Carta QR del cliente                                                                  |
| `/imprimir/[id]`                   | Papel para imprimir desde el navegador                                                |

## Ponerlo en un bar de verdad

1. Un ordenador (Windows, Mac o Linux, o una mini-PC) con Node 22, conectado al router por cable.
   En el router, darle **IP fija** (por ejemplo `192.168.1.50`).
2. `npm ci && npm run build && npm run start -- -p 3000`. Que arranque solo al encender (servicio
   de Windows, `systemd` o `pm2`).
3. Pantallas: abrir `http://192.168.1.50:3000` en cada una. En la cocina, una tablet en `/cocina`.
4. Impresoras: en **Gestión → Impresoras**, la IP de cada una y qué imprime.
5. QR: **Gestión → Mesas y QR → Imprimir los QR**, con la dirección `http://192.168.1.50:3000`.
   Los clientes tienen que estar en la wifi del bar (o publicar el servidor en internet con https).
6. Copia de seguridad: la carpeta `datos/` (un archivo). Copiarla cada noche a un USB o a la nube.
7. Variables: ver `.env.example`.

## Límites conocidos y siguientes pasos

- **VERI\*FACTU** sin terminar (ver `docs/INVESTIGACION.md`): XML del registro, envío a la AEAT, QR
  de cotejo y declaración responsable. Es lo primero antes de usarlo como TPV fiscal.
- **Historial en pantalla**: se mandan los últimos 62 días de tickets a las pantallas. Con años
  de historia, los informes largos deberían calcularse en el servidor.
- **Datáfono**: el cobro con tarjeta se apunta a mano. Integrar un datáfono (Redsys, Adyen, SumUp,
  Stripe Terminal) para que el importe vaya solo.
- **Ideas**: ver `docs/PLAN.md` (stock con escandallos, fichaje, reservas, pago desde el QR, ticket
  por correo, modo sin conexión en la PDA…).

## El servicio (fase 2)

- **Cobrar por partes**: se eligen platos y unidades; cada línea cobrada guarda el ticket que la
  pagó. La cuenta se cierra cuando ya no queda nada por cobrar.
- **Venta rápida**: `/sala/rapida` cobra en barra sin abrir mesa.
- **Para después y marcha**: lo marcado «después» espera en cocina hasta que el camarero da la
  marcha, que saca una comanda nueva.
- **Propinas**: se apuntan al cobrar y salen aparte en el ticket, en el cierre Z y en los informes.
- **Carta**: menú del día con opciones que van a otra pantalla, categorías con horario, textos en
  inglés para la carta QR y fotos (Supabase Storage con permiso de subida de un solo uso).

## Stock (fase 3)

- **Ingredientes** con existencias, mínimo, «pedir hasta», precio de la última compra y proveedor.
- **Escandallo** de cada plato: al mandarlo a cocina se descuenta lo que lleva; si se anula, se
  devuelve. Cuando no llega para una ración más, el plato se agota solo y vuelve al recibir género.
- **Lista de la compra** por proveedor con lo que está en el mínimo, para copiar o mandar por
  WhatsApp, y **recibir el pedido** (suma al stock y apunta el gasto en «Proveedores y género»).
- El coste de la ración sale del escandallo, y con él el margen de los informes.
- Con `ANTHROPIC_API_KEY`, el pedido se puede rellenar con una **foto de la factura**: Claude lee
  las líneas y las casa con los ingredientes; el encargado las revisa antes de guardar.
