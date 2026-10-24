# Comanda · TPV para bares

Los clientes ven la carta y piden desde el **QR de su mesa**; el pedido llega al camarero y a la
**pantalla de cocina y barra**, sale la **comanda impresa** en la impresora térmica, y desde la
**caja** (o desde el móvil del camarero) se cobra y se saca el **ticket**. El encargado lleva la
**carta, el plano de mesas, los gastos, el equipo y los informes** del negocio.

Todo en español, pensado para el dedo y para la wifi del local: funciona sin internet.

## Qué hace

- **Carta QR** (`/m/…`): carta con alérgenos y filtro, opciones (punto, extras), cesta, pedido,
  estado de cada plato, llamar al camarero y pedir la cuenta (tarjeta, efectivo o Bizum).
- **Sala** (`/sala`): plano por zonas con colores por estado (libre, ocupada, pedido QR, pide la
  cuenta, te llaman), avisos en directo, comanda por mesa con buscador, notas, opciones, rondas,
  invitaciones, anulaciones con motivo, descuentos, mover y juntar mesas, imprimir la cuenta y
  cobrar (efectivo con cambio, tarjeta, Bizum o mixto, y reparto entre comensales).
- **Cocina y barra** (`/cocina`): tarjetas por mesa y ronda, colores según la espera, pitido al
  entrar un pedido, plato a plato o «todo listo», y aviso al camarero.
- **Caja** (`/caja`): apertura con fondo, tickets del turno, reimprimir, devoluciones con
  rectificativa, entradas y salidas de dinero, y cierre Z contando billetes y monedas.
- **Gestión** (`/gestion`, solo encargados): resumen del día, informes por fechas (ventas por día y
  hora, productos con margen, camareros, formas de pago, IVA a liquidar, resultado), exportar a CSV
  para la gestoría, gastos con IVA soportado, editor de carta, editor del plano y hoja de QR,
  equipo con PIN y permisos, impresoras y ajustes del ticket.
- **Impresión**: impresoras térmicas ESC/POS por red (puerto 9100), por USB directo desde Chrome o
  con el diálogo de imprimir; comandas separadas por cocina y barra, tickets, cuentas, cierres y
  apertura del cajón.
- **Tickets**: factura simplificada numerada por serie y año, con desglose de IVA y huella SHA-256
  encadenada (preparada para VERI*FACTU, **aún no certificada**: ver `docs/INVESTIGACION.md`).

## Probarlo

```bash
npm install
npm run build && npm run start   # http://localhost:3000
```

Arranca con un bar de ejemplo («La Esquina», ficticio) con dos semanas de ventas. PIN: **Ana
1234** (encargada), **Luis 1111**, **Marta 2222**. En la portada hay un enlace a la carta QR de la
Mesa 1 para probar como cliente; ábrelo en otra ventana y mira cómo llega el pedido a la sala.

## En internet

Funciona igual en la nube con **Supabase** (datos y avisos en directo) y **Vercel** (la web). Las
impresoras del bar reciben los trabajos con el puente de impresión (Gestión → Impresoras). Ver
`docs/ARQUITECTURA.md`.

## Documentación

- `docs/INVESTIGACION.md`: repositorios parecidos, cómo se llama cada aparato, impresión y ley.
- `docs/ARQUITECTURA.md`: cómo funciona por dentro y **cómo instalarlo en un bar**.
- `docs/TRASPASO.md`: estado del trabajo y pendientes.

## Comprobaciones

```bash
npm run check      # lint, tipos, pruebas unitarias y build
npm run test:e2e   # Playwright en móvil y escritorio, con revisión de accesibilidad (axe)
```

Next.js 16, React 19, Tailwind 4, Zod. Todos los datos de ejemplo son ficticios.
