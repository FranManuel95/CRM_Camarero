# Declaración responsable de VERI*FACTU

La firma el **fabricante del programa** (tú), no el bar (art. 13 RD 1007/2023). No se presenta en
Hacienda: tiene que estar **dentro del propio programa**, fácil de encontrar, y entregarse a cada
bar al contratar (art. 15.3 de la Orden HAC/1177/2024).

## Dónde está

- En la app: `/declaracion-responsable`, enlazada desde Gestión → VERI*FACTU y desde `/legal`.
- Descargable en texto: `/api/declaracion` (para adjuntarla al contrato).
- El texto sale de `src/lib/dominio/declaracion.ts`, con los datos del art. 15.1 en su orden.
  El nombre (`Comanda`), el código (`CM`) y la versión (`1.0`) son los mismos que se mandan a la
  AEAT en cada envío (`SISTEMA`; hay una prueba que lo comprueba).

## Para firmarla

Pon en Vercel (Production) estas variables y vuelve a desplegar:

| Variable | Ejemplo |
| --- | --- |
| `VERIFACTU_PRODUCTOR_NOMBRE` | Nombre y apellidos o razón social |
| `VERIFACTU_PRODUCTOR_NIF` | NIF |
| `VERIFACTU_PRODUCTOR_DIRECCION` | Calle, número, código postal, ciudad, España |
| `DECLARACION_FECHA` | `01-12-2026` (día-mes-año) |
| `DECLARACION_LUGAR` | `Ciudad, España` |
| `LEGAL_TITULAR_CORREO` (opcional) | correo de contacto |

Mientras falte alguna, la página avisa de que es un borrador.

## Cuándo hay que hacer una nueva

Con cada versión que cambie lo que se declara (registros, huella, envío, QR): sube
`SISTEMA.version` y la fecha de firma. Guarda las declaraciones anteriores (las versiones que
usaron los bares).

## Antes de firmarla

1. Probar el envío contra el entorno de pruebas de la AEAT con un certificado real (.p12).
2. Revisarla con un asesor fiscal.
