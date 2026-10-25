# Plan de trabajo

Hoja de ruta acordada el 24/10/2026 (VERI*FACTU va aparte). Cada fase se entrega en uno o varios
commits, con `npm run check` y `npm run test:e2e` en verde y desplegada en
https://comanda-tpv.vercel.app. El estado de cada punto se marca aquí: [x] hecho, [~] a medias.

## Fase 1 · Un bar, una cuenta (para poder venderlo)

Hoy la web en la nube tiene un solo bar fijo. Al acabar esta fase, cualquier dueño se da de alta y
monta su bar sin ayuda.

- [x] **Cuenta del dueño**: registro y acceso con correo y contraseña (Supabase Auth).
- [x] **Varios bares**: cada uno con sus datos, su equipo, sus QR y su canal en directo. Un dueño
      puede tener más de un bar.
- [x] **Vincular un aparato al bar**: la tablet de la caja o el móvil del camarero se vinculan una
      vez (desde la cuenta del dueño o con un código) y luego solo piden el PIN.
- [x] **Bar nuevo**: con carta de ejemplo o vacía, y el PIN del encargado que elija el dueño.
- [x] **Primeros pasos**: lista en el resumen de Gestión (datos del ticket, carta, mesas, QR,
      equipo, impresora) que se va tachando sola.
- [x] **Panel de quien vende Comanda**: lista de bares, dueño, alta y última actividad.
- [x] El bar de demostración sigue en marcha para enseñarlo.

## Fase 2 · El servicio del día a día

- [x] **Dividir la cuenta por platos** («yo pago lo mío») y cobros parciales.
- [x] **Venta rápida en barra**: cobrar sin abrir mesa.
- [x] **Tiempos de servicio**: marcar platos como «después» y mandarlos con «marcha».
- [x] **Propinas** al cobrar, en el cierre de caja y por camarero.
- [x] **Menú del día**: primero, segundo, postre y bebida a precio cerrado.
- [x] **Cartas por horario**: desayunos, comidas, noches.
- [x] **Carta QR en inglés** (y textos de la carta traducibles).
- [x] **Fotos de los platos** (Supabase Storage).

## Fase 3 · Stock y compras

- [x] Ingredientes con existencias y unidad.
- [x] Escandallos: cada plato descuenta lo que lleva al venderse.
- [x] Avisos de mínimos, lista de la compra y agotado automático.
- [x] Recepción de pedidos de proveedor (suma existencias y apunta el gasto).
- [x] Factura de proveedor con foto (lectura automática). Hecho; se activa al poner
      `ANTHROPIC_API_KEY` en Vercel.

## Fase 4 · Equipo

- [x] Fichaje de entrada y salida con el PIN (registro de jornada obligatorio).
- [x] Cuadrante semanal de turnos.
- [x] Informe por camarero: ventas, propinas, anulaciones e invitaciones.

## Fase 5 · Clientes y más ventas

- [x] Reservas con plano y recordatorio.
- [x] Pagar desde el QR (Stripe; necesita cuenta del bar).
- [x] Ticket por correo (necesita un proveedor de correo).
- [x] Pedidos para llevar y recogida.
- [x] Invitación a dejar reseña al pagar.

## Fase 6 · A prueba de fallos

- [x] App instalable (PWA) a pantalla completa.
- [x] La PDA guarda lo anotado si se corta la wifi y lo manda al volver.
- [x] Historial de cambios (quién cambió qué) y copias de seguridad descargables.
- [ ] Datáfono integrado.

## Cosas que dependen del usuario

- Supabase → Authentication → Sign In / Providers → Email: desactivar «Confirm email» (acordado el
  25/10/2026 hasta tener un proveedor de correo). Mientras siga activo, las altas piden confirmar
  y el correo de Supabase solo manda unos pocos por hora.
- Supabase → Authentication → URL Configuration: poner `https://comanda-tpv.vercel.app` como
  Site URL y `https://comanda-tpv.vercel.app/**` en Redirect URLs (enlaces de los correos).
- Cuentas de Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y el webhook a
  `/api/pago/stripe`) y de Resend (`RESEND_API_KEY`, `CORREO_REMITENTE`) para encender el pago
  desde el QR y el ticket por correo.
- Clave de la API de Claude (`ANTHROPIC_API_KEY` en Vercel) para leer facturas con foto (fase 3).
