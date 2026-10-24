# Traspaso entre sesiones

## Dónde estamos (24/10/2026)

- **Rama**: `claude/hopeful-maxwell-o3aibm`. Primera versión completa del producto (ronda 1).
- **Hecho**: carta QR con pedidos, sala con plano y avisos, comanda, cobro, cocina y barra, caja
  con cierre Z, gestión (resumen, informes, gastos, carta, mesas y QR, equipo, impresoras,
  ajustes), impresión ESC/POS por red, USB y navegador, y tickets con huella encadenada.
- **Pruebas**: unitarias (`npm test`) y E2E en móvil y escritorio con axe (`npm run test:e2e`), en
  verde.

## Pendiente (por orden)

1. **VERI\*FACTU** antes de usarlo como TPV fiscal real (ver `docs/INVESTIGACION.md`).
2. Probar con una **impresora térmica real** de red (solo se ha probado el formato de los bytes y
   la vista previa; aquí no hay impresora).
3. Decidir con el usuario si se queda **en el PC del bar** (como ahora) o pasa a **la nube con
   Supabase** para varios locales.
4. Integración con datáfono, stock, reservas (ideas en `docs/ARQUITECTURA.md`).

## Trucos del entorno

- `next start` en segundo plano: matar el proceso con `pgrep -f "next start" | xargs kill`, no con
  `pkill -f` dentro del mismo comando (mata la propia shell).
- Los datos de prueba se guardan en `DATOS_DIR`; Playwright usa una carpeta temporal nueva en cada
  ejecución.
- Las pruebas E2E esperan a `html[data-conectado]`, que se pone cuando la pantalla recibe los datos
  en directo (antes de eso los clics se pierden porque React aún no ha hidratado).
