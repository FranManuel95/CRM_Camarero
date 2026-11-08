# Contrato de encargo del tratamiento (art. 28 RGPD)

> **Borrador.** Base para revisar con un abogado antes de firmar. Lo que va entre corchetes se
> rellena con los datos de cada bar. No es asesoramiento legal.

En [ciudad], a [fecha].

**De una parte**, [razón social del bar], con NIF [NIF] y domicilio en [dirección], representada
por [nombre y cargo] (en adelante, **el Responsable**).

**De otra parte**, [nombre o razón social del prestador], con NIF [NIF] y domicilio en
[dirección] (en adelante, **el Encargado**).

Ambas partes acuerdan este contrato, que forma parte del contrato de prestación del servicio
Comanda (en adelante, **el Servicio**).

## 1. Objeto

El Encargado trata, por cuenta del Responsable, los datos personales necesarios para prestar el
Servicio: el programa de gestión del bar en la nube (TPV, carta QR, pedidos, reservas, club de
clientes, caja, stock, equipo y fichajes, informes, impresión y, si el Responsable lo activa,
VERI\*FACTU y la lectura de facturas o de la carta con IA).

## 2. Duración

Lo que dure el Servicio. Al terminar se aplica la cláusula 10.

## 3. Naturaleza y finalidad

Alojar, guardar, consultar, modificar, copiar y borrar los datos que el Responsable y su equipo
introducen, y los que sus clientes dejan en las páginas públicas del bar, **con la única
finalidad** de prestar el Servicio. El Encargado no usa los datos para fines propios.

## 4. Datos y personas afectadas

Solo los de las funciones que el Responsable tenga encendidas:

| Personas | Datos |
| --- | --- |
| Clientes del bar | Nombre, teléfono, correo (si lo dan), consumos y puntos del club, reservas, pedidos para llevar, cuentas pendientes de pago. |
| Equipo del bar | Nombre, rol, PIN (guardado cifrado, nunca en claro), permisos, turnos del cuadrante y registro de jornada (entradas, pausas y salidas). |
| Proveedores | Nombre y datos de sus facturas y albaranes. |
| Dueño o encargado | Correo de la cuenta (la contraseña la guarda cifrada Supabase). |

No se tratan categorías especiales de datos (art. 9 RGPD). Los alérgenos de la carta se refieren a
los platos, no a las personas.

## 5. Obligaciones del Encargado

El Encargado se compromete a:

1. **Instrucciones.** Tratar los datos solo siguiendo las instrucciones documentadas del
   Responsable, que son este contrato y el uso que el Responsable hace del Servicio, incluido lo
   relativo a transferencias internacionales. Si una instrucción le parece contraria a la
   normativa, se lo dirá de inmediato.
2. **Confidencialidad.** Que las personas autorizadas a tratar los datos se comprometan por
   escrito a guardar confidencialidad.
3. **Seguridad (art. 32 RGPD).** Mantener, como mínimo, las medidas del anexo.
4. **Subencargados.** Respetar la cláusula 6.
5. **Derechos de los interesados.** Ayudar al Responsable a atender las peticiones de acceso,
   rectificación, supresión, oposición, limitación y portabilidad. El Servicio permite al
   Responsable consultar, corregir, dar de baja y exportar los datos por sí mismo. Si una petición
   llega al Encargado, la pasará al Responsable en un máximo de 5 días hábiles.
6. **Brechas de seguridad.** Avisar al Responsable sin dilación indebida, y en todo caso en un
   máximo de 48 horas desde que tenga conocimiento, de cualquier violación de seguridad que afecte
   a sus datos, con la información disponible para que el Responsable pueda notificarla a la AEPD
   (art. 33) y, si procede, a los afectados (art. 34).
7. **Ayuda (arts. 32 a 36 RGPD).** Ayudar al Responsable con la seguridad, las brechas y, si
   hiciera falta, las evaluaciones de impacto, con la información de que disponga.
8. **Demostrar el cumplimiento.** Poner a disposición del Responsable la información necesaria
   para demostrarlo y permitir auditorías razonables, avisando con al menos 15 días y sin
   interrumpir el servicio de otros clientes.

## 6. Subencargados

El Responsable autoriza de forma general que el Encargado se apoye en estos subencargados, que
asumen por contrato las mismas obligaciones:

| Subencargado | Para qué | Dónde |
| --- | --- | --- |
| Supabase Inc. | Base de datos y cuentas | Servidores en la Unión Europea (Francia) |
| Vercel Inc. | Alojamiento de la web | EE. UU. y UE; transferencias amparadas por el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo |
| Resend Inc. | Envío de correos (si se activa) | EE. UU.; mismas garantías |
| Proveedor de IA configurado (Google, Anthropic u otro) | Leer fotos de facturas y cartas (si se activa) | Según el proveedor; las fotos solo se usan para leerlas |

El Encargado avisará al Responsable con al menos 30 días de cualquier alta o cambio de
subencargado, y el Responsable podrá oponerse; si la oposición impide prestar el Servicio,
cualquiera de las partes podrá terminar el contrato sin penalización.

## 7. Obligaciones del Responsable

Facilitar los datos de forma lícita, informar a sus clientes y a su equipo (el Servicio genera el
aviso legal y la privacidad de las páginas públicas con los datos del bar), recoger el
consentimiento cuando haga falta (club, ofertas) y supervisar el tratamiento.

## 8. Transferencias internacionales

Solo las de la cláusula 6, con las garantías que allí se indican.

## 9. Responsabilidad

Cada parte responde de sus incumplimientos según el art. 82 RGPD. Si el Encargado decide por su
cuenta los fines o medios de un tratamiento, será considerado responsable de ese tratamiento.

## 10. Fin del encargo

Al terminar el Servicio, el Encargado **devolverá** al Responsable sus datos en un formato
reutilizable (la copia completa del bar en JSON y los informes en CSV) y después los **borrará**,
incluidas las copias de seguridad, en un máximo de 90 días. Se conservarán bloqueados solo los
datos que exija la ley (por ejemplo, los registros de facturación de VERI\*FACTU o el registro de
jornada) y durante el plazo que esta fije, si el Responsable no puede guardarlos por sí mismo.

## Anexo: medidas de seguridad

- Conexiones siempre cifradas (HTTPS/TLS) y cabeceras de seguridad (CSP, marcos solo propios).
- Base de datos cerrada: ninguna tabla es accesible desde fuera; solo funciones que exigen la
  clave secreta del servidor, y cada bar solo ve sus datos.
- Cuentas: contraseñas cifradas por Supabase y rechazo de contraseñas filtradas. PIN del equipo
  guardado cifrado, con bloqueo tras 8 intentos fallidos en 5 minutos.
- Permisos por persona dentro del bar (cobrar, anular, invitar, descuentos, caja).
- Tickets encadenados con huella (no se pueden borrar ni modificar: se rectifican).
- Registros técnicos sin datos personales y avisos automáticos de errores.
- Copias de seguridad diarias de cada bar y copia descargable por el encargado.
- Acceso del personal del Encargado a los datos solo cuando sea necesario para el soporte.

Firmado por ambas partes.

| El Responsable | El Encargado |
| --- | --- |
| [firma] | [firma] |
