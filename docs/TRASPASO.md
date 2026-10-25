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

## Pendiente (por orden)

1. **VERI\*FACTU** antes de usarlo como TPV fiscal real (ver `docs/INVESTIGACION.md`).
2. Probar con una **impresora térmica real** de red (solo se ha probado el formato de los bytes y
   la vista previa; aquí no hay impresora).
3. Fases 4 a 6 de `docs/PLAN.md` (stock, equipo, clientes…), cuando el usuario lo pida.

## Trucos del entorno

- `next start` en segundo plano: matar el proceso con `pgrep -f "next start" | xargs kill`, no con
  `pkill -f` dentro del mismo comando (mata la propia shell).
- Los datos de prueba se guardan en `DATOS_DIR`; Playwright usa una carpeta temporal nueva en cada
  ejecución.
- Las pruebas E2E esperan a `html[data-conectado]`, que se pone cuando la pantalla recibe los datos
  en directo (antes de eso los clics se pierden porque React aún no ha hidratado).
