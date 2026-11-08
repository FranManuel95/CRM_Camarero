# Encender VERI*FACTU

Todo está preparado en el programa: huella encadenada, QR tributario, envío a la AEAT,
reintentos, rectificativas y la declaración responsable. Encenderlo es configurar y comprobar.
Se tarda unos 20 minutos.

## Cuándo

- Obligatorio para el bar: **sociedades desde el 1/1/2027** y **autónomos desde el 1/7/2027**
  (RDL 15/2025; Hacienda ha anunciado otro aplazamiento a 2028 que aún no está en el BOE).
- Antes de cobrar por el programa, firma la declaración responsable
  (`docs/legal/declaracion-responsable.md`).

## 1. Lo que hay que pedir

- Al bar: su **certificado electrónico** (.p12 o .pfx) y su contraseña. Vale el de persona
  física (autónomo), el de representante de la sociedad o un certificado de sello. Si es de sello,
  hay que añadir `VERIFACTU_SELLO=1`.
- Tus datos de fabricante (nombre, NIF, dirección), la fecha y el lugar de la firma.

## 2. Pasar el certificado a texto (base64)

- **Windows** (PowerShell):
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\certificado.p12")) | Set-Clipboard`
- **Mac**: `base64 -i certificado.p12 | pbcopy`
- **Linux**: `base64 -w0 certificado.p12`

No lo mandes por correo ni lo guardes en el repositorio: pégalo directamente en Vercel.

## 3. Variables en Vercel (Production)

| Variable | Valor | Tipo |
| --- | --- | --- |
| `VERIFACTU_CERTIFICADO` | el base64 del paso 2 | Sensitive |
| `VERIFACTU_CLAVE` | la contraseña del certificado | Sensitive |
| `VERIFACTU_SELLO` | `1` solo si es certificado de sello | Plain |
| `VERIFACTU_PRODUCTOR_NOMBRE` | tu nombre o razón social | Plain |
| `VERIFACTU_PRODUCTOR_NIF` | tu NIF | Plain |
| `VERIFACTU_PRODUCTOR_DIRECCION` | tu dirección completa | Plain |
| `DECLARACION_FECHA` | `dd-mm-aaaa` | Plain |
| `DECLARACION_LUGAR` | `Ciudad, España` | Plain |
| `VERIFACTU_ENTORNO` | **no la pongas todavía** (sin ella, va a pruebas) | Plain |

Después, vuelve a desplegar (Vercel → Deployments → Redeploy) para que las lea.

## 4. Comprobar

En el bar, **Gestión → VERI*FACTU → Comprobar**. Revisa que salga en verde:

1. Datos fiscales del bar (razón social, NIF válido y dirección; se cambian en Ajustes).
2. Certificado: de quién es y cuándo caduca.
3. Que el certificado es del bar (si no, solo vale con apoderamiento o colaboración social).
4. Conexión con Hacienda: se abre una conexión con la AEAT con el certificado, sin mandar nada.
5. Datos del fabricante y declaración responsable.

## 5. Probar en el entorno de pruebas

1. **Gestión → Funciones → VERI*FACTU**: encender.
2. Cobra un ticket pequeño. En **Gestión → VERI*FACTU** debe pasar de «Por mandar» a «Aceptado» en
   menos de un minuto. El primero va marcado como «primer registro»: Hacienda empieza la cadena ahí.
3. Escanea el QR del ticket: abre el cotejo de la AEAT de pruebas.
4. Rectifica ese ticket y mira que la rectificativa (R5) también sale «Aceptado».
5. Si algo sale «Rechazado», el motivo viene en el registro; corrígelo y pulsa «Reintentar».

## 6. Pasar a producción

Cuando el bar esté obligado (o quiera empezar antes):

1. En Vercel, `VERIFACTU_ENTORNO=produccion` y redespliega.
2. **Comprobar** otra vez: la conexión ahora es con la AEAT de verdad.
3. El primer ticket en producción vuelve a ser «primer registro» (la cadena de pruebas no cuenta).

A partir de ahí no se apaga: si se apagara y se volviera a encender, la cadena para Hacienda
empezaría de nuevo y quedarían tickets sin mandar entre medias.

## Límite actual

El certificado va en el servidor, así que hoy vale para **un bar con VERI*FACTU**. Para varios
bares hay dos caminos: guardar el certificado de cada bar (cifrado) en la base de datos, o
mandar todo con un único certificado de quien presenta en nombre de los bares (colaboración
social o apoderamiento). Hay que hacerlo antes de encenderlo en un segundo bar.
