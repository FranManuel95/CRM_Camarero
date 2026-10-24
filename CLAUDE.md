# CRM_Camarero (Comanda)

TPV para bares: carta QR con pedidos, app de camarero, cocina, caja, gastos, informes e impresión
ESC/POS (Next.js 16, React 19, Tailwind 4, Zod).

- Al empezar una sesión, lee `docs/TRASPASO.md`. Contexto: `docs/INVESTIGACION.md` y
  `docs/ARQUITECTURA.md`.
- Todo cambio de datos es una **acción** (`src/lib/dominio/acciones.ts`) aplicada por `reducir`
  (`src/lib/dominio/reducir.ts`), función pura con pruebas en `tests/unit/`. Las pantallas nunca
  modifican el estado por su cuenta.
- Lógica sin React en `src/lib/` (dominio, impresión, fechas, CSV), con pruebas unitarias. El
  código de `src/lib/servidor/` es solo de servidor: no importarlo desde componentes de cliente.
- Importes siempre en céntimos y con IVA incluido. Horas en `Europe/Madrid` (`src/lib/fechas.ts`).
- Los tickets no se editan ni se borran: se rectifican. No romper la huella encadenada.
- Comprobaciones antes de subir cambios: `npm run check` y `npm run test:e2e` (requiere el build).
- Textos de la interfaz en español y en tono cercano. Todos los datos son ficticios. Nunca se
  añaden secretos ni datos personales reales.
