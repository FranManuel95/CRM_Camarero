import "server-only";
import { createConnection } from "node:net";

/**
 * Manda bytes ESC/POS a una impresora térmica de red por el puerto 9100 («raw» o «JetDirect»),
 * que es como imprimen casi todas las impresoras de cocina con cable de red o wifi.
 * Funciona cuando el servidor está en la misma red que la impresora (el PC del bar).
 */
export function enviarAImpresora(
  ip: string,
  puerto: number,
  bytes: Uint8Array,
  esperaMs = 6000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: ip, port: puerto });
    const fallo = (mensaje: string) => {
      socket.destroy();
      reject(new Error(mensaje));
    };
    socket.setTimeout(esperaMs, () =>
      fallo(`La impresora ${ip}:${puerto} no contesta. ¿Está encendida y en la misma red?`),
    );
    socket.once("error", (e: NodeJS.ErrnoException) =>
      fallo(
        e.code === "ECONNREFUSED"
          ? `La impresora ${ip}:${puerto} rechaza la conexión. Revisa el puerto.`
          : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH"
            ? `No llego a ${ip}. Revisa la IP de la impresora.`
            : `Error al imprimir: ${e.message}`,
      ),
    );
    socket.once("connect", () => {
      socket.end(Buffer.from(bytes), () => resolve());
    });
  });
}
