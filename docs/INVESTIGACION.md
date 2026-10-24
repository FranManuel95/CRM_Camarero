# Investigación: qué existe ya y qué pide la ley

Hecha el 24/10/2026 al arrancar el proyecto. Sirve para decidir qué construir y qué no reinventar.

## Cómo se llama cada cosa

| Lo que dijiste                     | Cómo se llama en el sector                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| «La caja registradora con monitor» | **TPV** (terminal punto de venta) táctil: un PC o tablet con el programa, la impresora de tickets y el cajón portamonedas. |
| «Pedir por la PDA o el móvil»      | **Comandero** o PDA de comandas.                                                                                           |
| «El aparatito que imprime»         | **Impresora térmica de tickets** (papel de 80 o 58 mm). Casi todas hablan el lenguaje **ESC/POS**.                         |
| «La pantalla de cocina»            | **KDS** (Kitchen Display System).                                                                                          |
| «El cajón del dinero»              | **Cajón portamonedas**: se conecta a la impresora de tickets (RJ11) y se abre con una orden ESC/POS.                       |
| «Cerrar la caja»                   | **Arqueo** y **cierre Z** (informe del turno).                                                                             |
| «El ticket»                        | Legalmente, **factura simplificada**.                                                                                      |

## Repositorios de código abierto revisados

| Proyecto                                                                                                                        | Qué es                                                                                                           | Qué aprovechamos                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [tastyigniter/TastyIgniter](https://github.com/tastyigniter/TastyIgniter) (PHP/Laravel, ~3.800 ★)                               | Pedidos online, reservas y gestión para restaurantes. Tiene una extensión de impresoras con modo USB por WebUSB. | La idea de imprimir desde el navegador por WebUSB (solo en https).             |
| [emreeren/SambaPOS-3](https://github.com/emreeren/SambaPOS-3) (C#, ~550 ★)                                                      | TPV táctil de restaurante para Windows, el clásico.                                                              | Modelo de mesas, tickets por mesa, impresoras por tipo de producto.            |
| [evan361425/flutter-pos-system](https://github.com/evan361425/flutter-pos-system) (Flutter, ~640 ★)                             | TPV para restaurantes pequeños en móvil.                                                                         | Pantallas pensadas para el dedo.                                               |
| [bailabs/tailpos](https://github.com/bailabs/tailpos) (React Native, ~670 ★)                                                    | TPV «offline first» para ERPNext.                                                                                | Que el bar siga funcionando sin internet.                                      |
| [itzzritik/OrderWorder](https://github.com/itzzritik/OrderWorder) (Next.js)                                                     | Carta QR, pedidos, cocina en tiempo real y panel.                                                                | Es lo más parecido a la parte QR; no tiene caja, tickets legales ni impresión. |
| [thisishowen-spec/eatlah](https://github.com/thisishowen-spec/eatlah), [softenrj/qr-menu](https://github.com/softenrj/qr-menu)  | Cartas QR con pedidos.                                                                                           | Lo mismo: solo la parte del cliente.                                           |
| [qzind/tray](https://github.com/qzind/tray) (Java, ~1.000 ★)                                                                    | Programa que se instala en el PC y deja a una web mandar órdenes crudas a impresoras.                            | Alternativa si algún día hace falta imprimir en impresoras USB sin Chrome.     |
| Odoo Point of Sale (módulo restaurante y pedidos por QR) y módulos como `pos_escpos_network_printer`                            | ERP completo con TPV de restaurante e impresión ESC/POS por red (puerto 9100).                                   | Confirma el enfoque: comandas por categoría a impresoras de red en el 9100.    |
| [mdiago/VeriFactu](https://github.com/mdiago/VeriFactu) (C#), [josemmo/Verifactu-PHP](https://github.com/josemmo/Verifactu-PHP) | Librerías para mandar los registros de facturación a la AEAT.                                                    | Referencia para el paso VERI*FACTU (ver más abajo).                            |
| [GeiserX/awesome-spain](https://github.com/GeiserX/awesome-spain)                                                               | Lista de software libre para España (VeriFactu, TicketBAI, Redsys…).                                             | Punto de partida para las integraciones españolas.                             |

**Conclusión:** no hay un proyecto libre y moderno que junte las cuatro piezas (carta QR, comandero,
caja con tickets legales españoles e impresión térmica) con una interfaz en español. Los que hay
cubren una parte. Por eso se ha hecho desde cero, copiando ideas probadas de los anteriores.

## Productos comerciales en España (la competencia)

Revo (iPad), Last.app (QR, delivery; unos 50 €/mes por local), Glop (muy implantado, interfaz
más antigua), Ágora (software y hardware), Square (básico gratis con comisión) y Qamarero. Todos
venden lo mismo que pides: sala, comandero, cocina, QR, caja e informes. Fuentes: comparativas de
[finantres.com](https://finantres.com/tpv-para-bares/) (con enlaces de afiliado: precios a
contrastar con cada proveedor).

## Impresión de comandas y tickets: tres caminos

1. **Impresora de red (lo recomendado para cocina).** El servidor manda los bytes ESC/POS por TCP
   al puerto 9100 de la impresora. No necesita ninguna pantalla encendida al lado. Es lo que hace
   Odoo. Implementado en `src/lib/servidor/impresora-red.ts`.
2. **USB directo desde el navegador (WebUSB).** Chrome y Edge pueden hablar con una impresora USB
   sin driver, solo en https o en `localhost`. Implementado en `src/lib/cliente/impresion-local.ts`.
3. **Diálogo de imprimir del sistema.** Vale para cualquier impresora con driver (también las
   térmicas). Es el modo por defecto y funciona en cualquier sitio.

Epson tiene además su propio SDK en JavaScript (ePOS) para sus TM con red; no hace falta porque el
puerto 9100 funciona con Epson y con las demás.

## Lo que pide la ley (España)

> Resumen para orientarse, no asesoramiento legal. Confírmalo con tu gestoría.

- **Factura simplificada** (RD 1619/2012, arts. 4 y 7): número y serie correlativos, fecha, NIF y
  nombre del emisor, tipo de IVA (o «IVA incluido») y total. En hostelería se puede hacer
  simplificada hasta 3.000 € (IVA incluido). Los tickets no se borran: se corrigen con una
  **rectificativa**. → Implementado.
- **Ley Antifraude y VERI\*FACTU** (Ley 11/2021, RD 1007/2023 y Orden HAC/1177/2024): el programa
  de facturación tiene que guardar cada ticket con una **huella encadenada** con el anterior, no
  dejar borrar ni retocar, llevar un QR de cotejo en el ticket y, en modo VERI*FACTU, mandar cada
  registro a la AEAT. Además, el fabricante del programa firma una **declaración responsable**.
  - Fechas vigentes según el RDL 15/2025: **1 de enero de 2027** para sociedades y **1 de julio de
    2027** para autónomos.
  - El Ministerio de Hacienda anunció el 5/10/2026 que quiere retrasarlo a **octubre de 2028**,
    pero, según varias fuentes a mediados de octubre, **aún no está publicado en el BOE**
    ([Holded](https://www.holded.com/es/blog/aplazamiento-verifactu),
    [VeriBai](https://veribai.com/calendario-verifactu),
    [Qamarero](https://qamarero.com/blog/verifactu-retraso-octubre-2028/)). Hay que comprobarlo en
    el BOE antes de fiarse de la fecha nueva.
  - **Estado aquí:** cada ticket ya lleva la huella SHA-256 encadenada con el formato del registro
    de alta de VERI*FACTU, no se puede borrar ni editar y la cadena se puede verificar. **Falta:**
    el XML del registro, la firma o el envío a la AEAT, el QR oficial de cotejo y la declaración
    responsable. Hasta entonces el programa **no** es un sistema certificado: no usarlo como TPV
    fiscal de un negocio real a partir de la fecha obligatoria.
- **TicketBAI** en País Vasco y **Batuz** en Bizkaia tienen su propio sistema (no cubierto).
- **Alérgenos** (Reglamento UE 1169/2011 y RD 126/2015): la carta debe informar de los 14
  alérgenos. → Implementado en la carta QR, con filtro para esconder platos.
- **Datos personales:** el QR del cliente no pide nombre, correo ni teléfono; el programa no
  guarda datos de clientes.
