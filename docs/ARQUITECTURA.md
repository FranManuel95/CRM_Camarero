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
- **Un solo local y un solo proceso**: el archivo JSON va bien para un bar. Para varios locales o
  para tenerlo en la nube, pasar el almacén a Supabase (Postgres con RLS y Realtime) manteniendo
  la misma interfaz de `src/lib/servidor/almacen.ts`.
- **Historial en pantalla**: se mandan los últimos 62 días de tickets a las pantallas. Con años
  de historia, los informes largos deberían calcularse en el servidor.
- **Datáfono**: el cobro con tarjeta se apunta a mano. Integrar un datáfono (Redsys, Adyen, SumUp,
  Stripe Terminal) para que el importe vaya solo.
- **Ideas**: stock e inventario con escandallos, reservas, dividir la cuenta por platos, propinas,
  pago desde el QR, ticket por correo, modo sin conexión en la PDA (PWA), varias cartas por horario.
