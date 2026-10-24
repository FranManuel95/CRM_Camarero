#!/usr/bin/env node
// Puente de impresión de Comanda.
//
// Se deja funcionando en un ordenador del bar (el de la caja, una mini-PC o una Raspberry Pi)
// conectado a la misma red que las impresoras térmicas. Pregunta a la web cada 2 segundos qué hay
// que imprimir y lo manda a cada impresora por su IP (puerto 9100).
//
// Uso (necesita Node 18 o más nuevo, sin instalar nada más):
//   node puente-impresion.mjs https://tu-comanda.vercel.app CLAVE_DEL_PUENTE
// La clave sale en Gestión → Impresoras.

import { createConnection } from "node:net";

const [, , direccion, clave] = process.argv;
if (!direccion || !clave) {
  console.error("Uso: node puente-impresion.mjs https://tu-comanda.vercel.app CLAVE_DEL_PUENTE");
  process.exit(1);
}
const api = new URL("/api/puente", direccion).toString();
const cabeceras = { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" };

function imprimir(ip, puerto, bytes) {
  return new Promise((ok, mal) => {
    const s = createConnection({ host: ip, port: puerto });
    s.setTimeout(6000, () => {
      s.destroy();
      mal(new Error(`La impresora ${ip}:${puerto} no contesta`));
    });
    s.once("error", (e) => mal(new Error(`${ip}:${puerto}: ${e.message}`)));
    s.once("connect", () => s.end(bytes, ok));
  });
}

let avisadoSinConexion = false;
async function vuelta() {
  try {
    const r = await fetch(api, { headers: cabeceras });
    if (r.status === 401) {
      console.error("La clave del puente no vale. Cópiala otra vez de Gestión → Impresoras.");
      process.exit(1);
    }
    const { trabajos } = await r.json();
    if (avisadoSinConexion) console.log("Conexión recuperada.");
    avisadoSinConexion = false;
    for (const t of trabajos) {
      let resultado;
      try {
        await imprimir(t.ip, t.puerto, Buffer.from(t.datos, "base64"));
        console.log(`${new Date().toLocaleTimeString("es-ES")}  ✓ ${t.titulo} → ${t.impresora}`);
        resultado = { id: t.id, ok: true };
      } catch (e) {
        console.error(`${new Date().toLocaleTimeString("es-ES")}  ✗ ${t.titulo}: ${e.message}`);
        resultado = { id: t.id, ok: false, error: e.message };
      }
      await fetch(api, { method: "POST", headers: cabeceras, body: JSON.stringify(resultado) });
    }
  } catch (e) {
    if (!avisadoSinConexion)
      console.error(`Sin conexión con ${direccion} (${e.message}). Reintentando…`);
    avisadoSinConexion = true;
  }
  setTimeout(vuelta, 2000);
}

console.log(`Puente de impresión conectado a ${direccion}. Deja esta ventana abierta.`);
vuelta();
