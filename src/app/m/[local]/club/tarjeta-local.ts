/** El código de la tarjeta del club se guarda en el móvil del cliente para la próxima vez. */
const clave = (local: string) => `comanda.club.${local}`;

export function guardarTarjeta(local: string, codigo: string) {
  try {
    localStorage.setItem(clave(local), codigo);
  } catch {
    // Sin almacenamiento (modo privado): tendrá que guardar el enlace de su tarjeta.
  }
}

export function leerTarjeta(local: string): string | null {
  try {
    return localStorage.getItem(clave(local));
  } catch {
    return null;
  }
}
