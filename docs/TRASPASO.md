# Traspaso entre sesiones

## Dónde estamos (24/10/2026)

- **Rama**: `claude/hopeful-maxwell-o3aibm`. Primera versión completa del producto (ronda 1).
- **Hecho**: carta QR con pedidos, sala con plano y avisos, comanda, cobro, cocina y barra, caja
  con cierre Z, gestión (resumen, informes, gastos, carta, mesas y QR, equipo, impresoras,
  ajustes), impresión ESC/POS por red, USB y navegador, y tickets con huella encadenada.
- **Pruebas**: unitarias (`npm test`) y E2E en móvil y escritorio con axe (`npm run test:e2e`), en
  verde.

## En la nube (24/10/2026)

- **Supabase**: proyecto `comanda-tpv` (`ayuiugvmzgtzpfsgxeue`, París, plan gratuito). Migración
  `20261024120000_tpv.sql` aplicada. Local `la-esquina` creado con su clave (hash en
  `privado.claves`). Para hacer sitio se pausó **AppCitas** (`wltzweynizuzoicsoyjp`) con permiso
  del usuario: sus datos siguen ahí y se reactiva desde el panel de Supabase.
- **Vercel**: proyecto `comanda-tpv` enlazado a GitHub, rama de producción
  `claude/hopeful-maxwell-o3aibm` (cada push despliega). Variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `TPV_LOCAL`, `TPV_CLAVE` (sensible). La clave está
  también en `.env.local` del usuario (nunca en el repositorio).
- En la nube los tickets son definitivos: «Volver a los datos de ejemplo» no funciona allí.

## Fase 1: varios bares (25/10/2026)

- Hoja de ruta completa en `docs/PLAN.md`.
- Migración `20261025090000_varios_locales.sql` aplicada (sin borrar `privado.claves`, que queda
  sin uso: borrarla pide confirmación del usuario en el MCP de Supabase).
- Datos de prueba que se quedan: cuenta `perejonfcomanuel+prueba@gmail.com` (confirmada a mano
  por SQL, con permiso del usuario; contraseña de prueba solo en la sesión de trabajo) y el bar
  `bar-de-prueba-automatica`.
- Supabase rechaza correos de dominios inventados (example.com…): para probar altas hace falta un
  correo real.

## Fase 2: el servicio del día a día (25/10/2026)

- Cobro de una parte (`cobrar` con `partes`): las líneas cobradas llevan `ticketId` y la cuenta se
  cierra sola cuando no queda nada. La cuenta cobrada sigue en cocina mientras haya platos sin
  servir (`cuentaEnJuego`).
- Venta rápida (`/sala/rapida`, acción `venta_rapida`): cuenta con mesa `venta-rapida`.
- «Para después» y «Marcha»: las líneas `despues` se quedan `en_espera` hasta la acción `marchar`,
  que imprime una comanda con el título «¡MARCHA!».
- Propinas: en el ticket fuera de la base imponible, en el cierre Z y en informes por camarero.
- Menú del día: plantilla en el editor de la carta; cada opción puede ir a otra pantalla
  (`destino`), y cocina la ve en gris si el plato principal no es suyo.
- Cartas por horario (`src/lib/dominio/horario.ts`), textos en inglés (`nombreEn`,
  `descripcionEn`) y fotos en Supabase Storage (bucket `fotos`, migración
  `20261025120000_fotos.sql` aplicada; la app da un permiso de 10 minutos por foto). En modo
  archivo las fotos van a `datos/fotos` y se sirven por `/api/fotos/[archivo]`.
- El bar de demostración de la nube ya existía: los nombres en inglés de su carta se añadieron con
  una consulta SQL sobre `estados` (subiendo la revisión y avisando por Realtime).

## Fase 3: stock y compras (25/10/2026)

- `src/lib/dominio/stock.ts`: ingredientes (kg, l o ud), escandallos (`Producto.receta`), lista de
  la compra y lectura de facturas (`pedidoDeFactura`). Estado en versión 3 (`ingredientes`,
  `movimientosStock`; la migración los crea vacíos).
- Se descuenta al **mandar** a cocina (`mandarRonda`), no al cobrar; la línea queda `descontado`
  y, si se anula, se devuelve. Los platos sin stock para una ración se ponen agotados solos
  (`agotadoPorStock`) y vuelven al entrar género; lo agotado a mano no lo toca el stock.
- Acciones: `ajustar_stock` (recuento o merma, cualquiera del equipo), `guardar_ingrediente`,
  `borrar_ingrediente` y `recibir_compra` (suma, actualiza el precio y apunta el gasto).
- Pantalla `/gestion/stock` y escandallo en el editor de la carta. Los bares nuevos con la carta de
  ejemplo empiezan sin stock ni escandallos.
- Facturas con foto: `/api/facturas` → `src/lib/servidor/facturas.ts` (SDK `@anthropic-ai/sdk`,
  salida estructurada con Zod). Solo sale el botón si hay `ANTHROPIC_API_KEY`; sin la clave no se
  ha podido probar contra la API de verdad.
- Arreglado: en el móvil, el menú de Gestión ensanchaba toda la página
  (`grid-cols-[minmax(0,1fr)]`).

## Fase 4: equipo (25/10/2026)

- Estado en versión 4: `fichajes`, `cuadrante` e `incidencias` (`src/lib/dominio/equipo.ts`).
- **Registro de jornada** (art. 34.9 ET: entrada y salida diarias, cuatro años, a disposición de
  la persona, sus representantes y la Inspección). Se ficha en `/fichar` con el PIN, sin abrir
  sesión (`/api/fichar`); también hay un botón «Fichar» en la barra. Acción `fichar`
  (entrada, pausa, vuelta, salida). Los fichajes no se borran: `corregir_fichaje` (encargado, con
  motivo) guarda en `cambios` quién, cuándo, por qué y lo que había antes.
- En la nube, los fichajes van en la tabla `fichajes` (migración `20261026090000_fichajes.sql`,
  aplicada): `tpv_cargar` trae los recientes y los abiertos, `tpv_guardar_v2` guarda solo los que
  cambian y `tpv_fichajes` da un periodo entero para el CSV (`/api/registro-jornada`). La
  `tpv_guardar` antigua se queda sin uso; se puede borrar más adelante.
- Una entrada sin salida de más de 16 h se da por olvidada: deja volver a entrar y sale avisada
  en Equipo → Fichajes para corregirla.
- **Cuadrante** semanal (`guardar_turno`, `borrar_turno`, `copiar_semana`), con impresión.
  Guarda los últimos 120 días.
- **Informe por camarero** (Informes): ventas, tickets, propinas, anulaciones e invitaciones
  (de `incidencias`, que se apuntan al anular algo ya mandado o al invitar) y horas fichadas.
- `vistaPersonal` recibe quién mira: un camarero solo recibe sus fichajes e incidencias.
- Arreglado: los textos `sr-only` dentro de una tabla con scroll ensanchaban la página en el
  móvil (el contenedor necesita `relative`).

## Móvil al 100 % (25/10/2026)

- Revisadas todas las pantallas a 360 px (y 768 px). Nada se sale por los lados y no quedan
  botones de menos de 24 px; lo comprueba `tests/e2e/movil.spec.ts`.
- Barra de arriba: en el móvil, icono con el nombre debajo y todas las secciones a la vista.
  Menú de Gestión: en el móvil, un botón con la sección actual que despliega las demás.
- Sala con las zonas a todo lo ancho; carta de gestión, fichajes, impresoras y recibir pedido
  reordenados para pantallas estrechas; cuadrante como lista por días en el móvil.
- Ojo con `capitalize` de CSS: pone en mayúscula cada palabra («19 De Octubre»). Usar
  `conMayuscula` (`src/lib/fechas.ts`).
- Ojo con `pgrep -f next-server`: se encuentra a sí mismo. Usar `pgrep -f "^next-server"`.
- Datos de ejemplo: los fichajes siguen el cuadrante (que ahora cubre también el historial).

## Funciones activables (25/10/2026)

- `src/lib/dominio/funciones.ts`: lista de funciones (grupo, nombre, explicación, valor por
  defecto y, si hace falta, el servicio del servidor que necesitan). Se guardan en
  `ajustes.funciones`; lo que no está va por defecto. Gestión → Funciones las enciende y apaga
  (acción `cambiar_funcion`, solo encargado). `guardar_ajustes` no las toca.
- Apagada, una función desaparece de las pantallas (`useFuncion`, `<SiFuncion>`) y sus
  acciones se rechazan en el reductor (`apagada`). Los datos se conservan.
- Para añadir una función nueva: entrada en `FUNCIONES`, comprobación en el reductor y en las
  pantallas. Las que necesitan una clave declaran `necesita` y `servicios()` dice si está.

## Fase 6: a prueba de fallos (25/10/2026)

- Estado en versión 5 (`historial`). Todo activable en Gestión → Funciones.
- **Historial de cambios** (`src/lib/dominio/historial.ts`): `reducirPersonal` apunta una frase
  por cada acción importante (anular, invitar, descuentos, caja, carta, equipo, funciones…). Lo
  del día a día no. Solo lo ve el encargado. Como mucho 1000 entradas.
- **Copias de seguridad** (`src/lib/dominio/copia.ts`, `/api/copia`): descargar todo (en la nube
  con `tpv_tickets` y `tpv_fichajes`, migración `20261026120000_tickets_por_fechas.sql`
  aplicada). Restaurar solo en modo archivo, comprobando la cadena de huellas. En modo archivo,
  copia diaria automática en `datos/copias` (14 días).
- **App instalable**: `src/app/manifest.ts`, iconos en `public/iconos`, `public/sw.js` (nunca
  guarda `/api`; archivos estáticos primero de la caché, pantallas primero de la red).
- **Sin wifi** (`src/lib/cliente/sin-red.ts` + `datos-personal.tsx`): si una acción de servicio
  falla por red, se guarda en el aparato, se aplica en pantalla con el mismo reductor y se manda
  en orden al volver. `abrir_cuenta` acepta `cuentaId` (`sr-…`) para poder anotar en una mesa
  abierta sin red. Sin red, la sala abre la comanda dentro de sí misma (no puede navegar).
- SHA-256 propio (`src/lib/sha256.ts`, probado contra `node:crypto`) para que el reductor
  funcione en el navegador.
- Ojo: en la demo de la nube los tickets del historial antiguo no van en orden de fecha (eso ya
  está arreglado en `demo.ts`, pero el bar `la-esquina` se creó antes).

## Fase 5: clientes (25/10/2026)

- Estado en versión 6 (`reservas`, `pagosOnline`). Todo activable en Gestión → Funciones; lo que
  abre el bar a internet (reservar desde la web, encargar desde el móvil, reseñas) viene apagado.
- **Para llevar**: cada encargo es una cuenta con `llevar` y `mesaId` = `llevar-<id>` (una «mesa»
  propia; `buscarMesa` en `selectores.ts` da su nombre). Lista en la sala hasta entregarlo.
- **Encargos desde el móvil**: `/m/<bar>/llevar` → `/api/encargo/<bar>` crea la cuenta con un
  `token` y manda al cliente a `/m/<bar>/<token>`: la misma carta QR (`vistaCliente` y
  `reducirCliente` aceptan códigos de mesa o de encargo).
- **Reservas**: `/sala/reservas`, en el plano dos horas antes (`reservas.ts`), «Han llegado» abre
  la mesa (`sentar_reserva`). Desde la web, `/m/<bar>/reservar` (quedan por confirmar; 3 por
  teléfono como mucho). Se guardan 90 días.
- **Pagar desde el QR**: quitado el 29/10/2026 (el bar no quiere cobros desde el móvil). La
  migración a la versión 7 borra `pagosOnline`.
- **Ticket por correo** (`src/lib/servidor/correo.ts`, Resend): desde la caja y desde la carta
  después de pagar. El correo no se guarda. Necesita `RESEND_API_KEY` y `CORREO_REMITENTE`.
- **Reseñas**: enlace en Ajustes; sale en la carta al pagar y con un QR al pie del ticket.
- Sin probar contra Resend de verdad (no hay clave).

## VERI*FACTU (26/10/2026)

- Fechas (RDL 15/2025): obligatorio desde el 1/1/2027 para sociedades y desde el 1/7/2027 para
  el resto. Hacienda anunció en octubre de 2026 otro aplazamiento a 2028, sin publicar aún en el
  BOE. El fabricante del programa ya está obligado desde el 29/7/2025.
- **Huella** (`huella.ts`): la del registro de alta de la AEAT, con la fecha de Madrid
  («dd-mm-aaaa») y la hora con huso. Probada con el ejemplo oficial de la AEAT. Todos los tickets
  nuevos la usan, y además guardan `tipoFactura` (F2 o R5) y `generadoEn`. Los antiguos siguen
  encadenados (la comprobación mira solo los enlaces).
- **Con la función encendida** (`verifactu.ts`, `sellarTicket`):
  - Cada ticket lleva el QR de cotejo (`urlQr`) con «QR tributario:» y la leyenda VERI*FACTU.
  - Cada ticket deja su registro en `estado.verifactu.registros`.
  - La rectificativa es R5, por diferencias, y dice qué ticket rectifica.
- **Envío** (`src/lib/servidor/verifactu.ts`, `src/lib/aeat/xml.ts`):
  - Cuándo: SOAP con el certificado del bar, después de cada cobro (`after`) o con «Mandar lo
    pendiente» en Gestión → VERI*FACTU.
  - Espera entre envíos: la que pida la AEAT (60 s), apartando el turno antes de mandar.
  - Duplicados: el código 3000 cuenta como enviado.
  - El XML se ha validado contra el XSD oficial (SuministroLR.xsd) con lxml, fuera del
    repositorio.
- **Variables:**
  - `VERIFACTU_CERTIFICADO`: el .p12 en base64.
  - `VERIFACTU_CLAVE`: su contraseña.
  - `VERIFACTU_PRODUCTOR_NOMBRE` y `VERIFACTU_PRODUCTOR_NIF`: quien fabrica el programa.
  - `VERIFACTU_ENTORNO=produccion`: sin ella, los QR y el envío van al entorno de pruebas.
  - `VERIFACTU_SELLO=1`: si el certificado es de sello.
- **Falta:**
  - Probarlo contra la AEAT de pruebas con un certificado de verdad.
  - La declaración responsable del fabricante (art. 13 RD 1007/2023).
  - El registro de anulación: no se usa, porque los tickets se rectifican.
  - Los registros de evento: solo hacen falta en la modalidad no VERI*FACTU.
- Las pruebas E2E arrancan con un certificado falso (`playwright.config.ts`): se puede encender
  y se ve el fallo del envío sin llegar a la AEAT.

## Lo que pidió el primer bar (29/10/2026)

Estado en versión 7 (`clientes`; fuera `pagosOnline`). Todo con pruebas unitarias y E2E.

- **Servicio**
  - «Comanda en papel: sí/no» al mandar (`enviar_comanda.imprimir`); por defecto, lo de Ajustes →
    Servicio (`imprimirComandas`). Sin papel, solo va a la pantalla de cocina y barra.
  - «Precios y descuentos» en la cuenta y al cobrar (`sala/[mesaId]/precios.tsx`): % o precio
    nuevo a uno o varios artículos (`ajustar_lineas`), % o euros a toda la cuenta y «Cobrar
    justo». `preciosSoloEncargado` lo limita al encargado.
  - Productos ocultos (`producto.oculto`): no los ven ni camareros ni clientes; el encargado los
    ve con borde discontinuo y los anota igual, también los agotados.
- **Reseñas** (Gestión → Reseñas): con el Place ID sale el enlace directo a escribir la reseña;
  QR grande al cobrar, al pie del ticket y carteles para las mesas.
- **Club de clientes** (función `club`, apagada): alta desde el QR (`/m/<bar>/club`, con
  consentimiento RGPD apuntado) o en la cuenta. Puntos por euro, premio en euros que se canjea
  como descuento al cobrar, historial, favoritos y baja (borra los datos). Gestión → Clientes.
- **Fiado** (función `fiado`, apagada): «A deber» al cobrar si la cuenta tiene cliente del club;
  el ticket sale como siempre (método `fiado`) y la deuda se salda desde la ficha.
- **Tarifas** (`tarifas.ts`, función `tarifas`): % por horario, días y zona (happy hour,
  terraza). Se aplica al anotar; la carta QR enseña el precio de carta tachado.
- **Tiempos de cocina** (`tiempos.ts`): al marcar listo se guarda por día y plato; Informes los
  enseña del más lento al más rápido.
- **Reparto de propinas** (`repartoPropinas` en `equipo.ts`): por horas fichadas o a partes
  iguales, en Informes.
- **Alertas** (`alertas.ts`): descuadre, anulaciones, reservas por confirmar, rechazos de
  Hacienda, stock y deudas. En Gestión → Resumen, con contador en el menú y notificación del
  navegador si se permite.
- **Pantalla de pedidos** (`/pedidos`): para una tele de cara al público, los encargos para
  llevar «Preparando» y «¡Listo!», con el nombre y la inicial.
- El menú del día ya existía: plantilla en el editor de la carta.
- **Mesas sin ticket en papel** (`mesa.sinTicket`, en Gestión → Mesas): al cobrar no se
  imprime (el cobro lleva `imprimir`; el camarero puede cambiarlo en ese cobro). El ticket se
  genera y se encadena igual, y si se paga en efectivo se abre el cajón.
- **Decoraciones del plano** (`estado.decoraciones`, `components/decoracion-plano.tsx`):
  mostrador, pared, puerta, ventana, planta, columna, aseos, cocina y rótulo. Se arrastran como
  las mesas, con ancho, alto, girar y duplicar. En la sala se ven debajo de las mesas, sin tocar.

## Herramientas del encargado (29/10/2026)

- **Subir precios de golpe** (`precios-carta.ts`, acción `subir_precios`): % por categorías con
  redondeo a 0,05/0,10/0,50 y vista previa en Gestión → Carta. Los suplementos no cambian.
- **Cierre guiado** (Caja → Cerrar caja): pendiente (mesas, avisos, alertas) → contar (por
  billetes o el total) → resumen (métodos, datáfono, anulaciones, lo más vendido) → Z.
- **Resumen diario por correo** (`resumen-diario.ts`, `/api/resumen-diario`, cron en
  `vercel.json` a las 6:17 UTC): Gestión → Ajustes, con vista previa. Para mandarlo hacen falta
  `RESEND_API_KEY`, `CORREO_REMITENTE` y `CRON_SECRET` en Vercel (sin `CRON_SECRET` el cron no
  hace nada).
- **Permisos por persona** (`permisos.ts`, `empleado.permisos`): cobrar, anular, invitar,
  precios y descuentos, caja. El encargado siempre puede todo; el reductor lo comprueba y las
  pantallas esconden lo que no se puede.
- **Rápidos** (`rapidos.ts`): primera pestaña de la carta del camarero con lo más pedido a esa
  hora en las últimas 4 semanas (sale si hay al menos 4).
- **Distribuciones guardadas** (`estado.planos`, hasta 10): guardar/usar/borrar en Mesas y QR.
- **Carta desde una foto** (`src/lib/servidor/carta-foto.ts`, `/api/carta-foto`): con
  `ANTHROPIC_API_KEY`; se revisa antes de `importar_carta`, que no duplica lo que ya hay.
- **Buscador de Gestión** (`buscador.ts`, Ctrl+K): carta, tickets (se abren y se reimprimen),
  clientes, mesas, equipo, gastos, stock y secciones. `?producto=` y `?cliente=` abren la ficha.

## Pendiente (por orden)

1. **VERI\*FACTU**: probarlo con la AEAT de pruebas y un certificado real, y la declaración
   responsable, antes de usarlo como TPV fiscal real.
2. Probar con una **impresora térmica real** de red (solo se ha probado el formato de los bytes y
   la vista previa; aquí no hay impresora).
3. Datáfono integrado (hace falta elegir proveedor).
4. Clave de Resend en Vercel cuando el bar tenga cuenta.

## Trucos del entorno

- `next start` en segundo plano: matar el proceso con `pgrep -f "next start" | xargs kill`, no con
  `pkill -f` dentro del mismo comando (mata la propia shell).
- Los datos de prueba se guardan en `DATOS_DIR`; Playwright usa una carpeta temporal nueva en cada
  ejecución.
- Las pruebas E2E esperan a `html[data-conectado]`, que se pone cuando la pantalla recibe los datos
  en directo (antes de eso los clics se pierden porque React aún no ha hidratado).
