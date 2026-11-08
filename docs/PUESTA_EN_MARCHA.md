# Puesta en marcha de un bar

Guía para el día de la instalación. Se tarda unas **2 horas** con el dueño o encargado delante,
mejor con el bar cerrado. Imprímela y ve tachando.

## Antes de ir (tú)

- [ ] Contrato del servicio y encargo de tratamiento firmados (`docs/legal/`).
- [ ] Declaración responsable de VERI\*FACTU con tus datos (`/declaracion-responsable`).
- [ ] Pide al bar: la carta (foto o PDF), cuántas mesas y cómo se llaman, quién trabaja y qué
      hace cada uno, qué impresoras tienen (marca, modelo y cómo se conectan) y sus datos
      fiscales (razón social, NIF, dirección, un correo de contacto).
- [ ] Si emiten con VERI\*FACTU: su certificado digital (.p12) y su contraseña.
- [ ] Lleva un cable de red y, si puede ser, una impresora de tickets de repuesto para probar.

## 1. Cuenta y bar (10 min)

- [ ] El dueño se da de alta en la web (**Dar de alta tu bar**) con su correo.
- [ ] En **Mis bares → Bar nuevo**: nombre del bar, su nombre y su PIN de encargado. Si su carta
      se parece a la de un bar normal, marca «Empezar con una carta de ejemplo» y luego se
      cambian precios y nombres.
- [ ] **Gestión → Ajustes**: razón social, NIF, dirección, teléfono y **correo de contacto**.
      El aviso de abajo dice qué falta para que el aviso legal esté completo. Revisa la serie de
      los tickets y el mensaje del pie.

## 2. Carta (30 min)

- [ ] **Gestión → Carta**: «Cargar la carta desde una foto» (si hay clave de IA) o a mano.
- [ ] Repasa con el encargado: precios con IVA, a qué va cada cosa (cocina o barra), alérgenos,
      opciones (punto de la carne, tamaño) y suplementos.
- [ ] Lo que no se vende ahora, como **oculto**, no borrado.

## 3. Mesas y QR (15 min)

- [ ] **Gestión → Mesas y QR**: crea las mesas con sus nombres de verdad («Terraza 3») y colócalas
      en el plano como están en el local. Añade barra, puertas y decoración si ayuda.
- [ ] Las mesas que nunca llevan ticket (por ejemplo, la del personal): «Sin ticket en papel».
- [ ] Si van a pedir por QR: imprime la hoja de «QR de las mesas» y pégalos en las mesas.

## 4. Equipo y aparatos (20 min)

- [ ] **Gestión → Equipo**: una persona por trabajador, con su rol y un PIN distinto. Quita los
      permisos que no deban tener (anular, invitar, descuentos, caja).
- [ ] En cada móvil o tablet: abrir la web → **Entrar** → identificador del bar + el código de 6
      cifras de **Equipo → Vincular un aparato**. Instálala en la pantalla de inicio («Añadir a
      pantalla de inicio») para que se abra como una app.
- [ ] Cada camarero entra una vez con su PIN para comprobar que lo recuerda.

## 5. Impresoras (30 min)

En **Gestión → Impresoras → Añadir impresora**, según cómo esté conectada:

| Cómo está | Qué elegir | Qué hace falta |
| --- | --- | --- |
| Con cable de red o wifi (tiene IP) | Por red | La IP fija (configúrala en el router) y el puerto 9100 |
| USB o Bluetooth al ordenador de la caja | Desde el ordenador | El puente instalado en ese ordenador |
| Puerto serie / COM o Bluetooth clásico | Desde el ordenador → Puerto | El puente y la velocidad (normalmente 9600 o 115200) |
| USB o Bluetooth a la tablet de la caja | Desde esta pantalla | Chrome; vincularla en «Esta pantalla» |
| Ninguna de las anteriores | Diálogo de imprimir | Nada (es el plan B) |

- [ ] **Puente** (si hay impresoras «Desde el ordenador»): copia el comando que sale en la
      tarjeta del puente y ejecútalo en el ordenador de la caja. Se arranca solo al encenderlo.
      Ese ordenador, **por cable** y sin suspenderse.
- [ ] Para cada impresora: **Imprimir prueba** y comprueba que sale bien (acentos, ancho de 58 u
      80 mm, corte). Asigna qué imprime cada una (tickets, cocina, barra).
- [ ] Si hay cajón portamonedas: conectado a la impresora de tickets; prueba que se abre al cobrar
      en efectivo.

## 6. Funciones (10 min)

- [ ] **Gestión → Funciones**: enciende solo lo que van a usar (reservas, para llevar, club,
      fiado, propinas, stock, fichajes, VERI\*FACTU…). Menos botones = menos dudas.
- [ ] Si usan VERI\*FACTU: certificado subido (variables `VERIFACTU_*`), primero en **pruebas**;
      cobra un ticket y mira en **Gestión → VERI\*FACTU** que sale «Correcto».

## 7. Ensayo general (20 min)

Con dos o tres personas, cada una con su aparato:

- [ ] **Caja → Abrir caja** con el fondo de verdad.
- [ ] Abrir mesa, anotar, mandar a cocina: sale la comanda en su impresora.
- [ ] Pedido desde el QR de una mesa: llega y se acepta.
- [ ] Cobrar en efectivo (sale el ticket y se abre el cajón), con tarjeta y a medias.
- [ ] Rectificar un ticket y reimprimirlo.
- [ ] Apagar el wifi de un móvil, anotar una mesa y volver a encenderlo: se manda solo.
- [ ] **Caja → Cerrar caja**: contar, ver el resumen y sacar el Z.
- [ ] Rectifica los tickets de prueba o déjalo claro en el primer cierre.

## 8. Antes de irte

- [ ] El encargado sabe: abrir y cerrar caja, rectificar, apagar un plato agotado, dar de alta a
      alguien del equipo y vincular un móvil nuevo.
- [ ] Copia de seguridad encendida (**Funciones → Copias de seguridad**): se hace sola cada noche.
- [ ] Si quieren el resumen diario por correo: **Ajustes** (necesita el correo configurado en el
      servidor).
- [ ] Deja apuntado tu teléfono de soporte.
- [ ] Recomendado: 1 o 2 semanas en paralelo con su caja de antes.

## Primer día de servicio

Pásate o llama a mitad del servicio. Mira en **Gestión → Resumen** las alertas (impresiones
atascadas, descuadres) y en los registros de Vercel los `accion_rechazada` del bar.
