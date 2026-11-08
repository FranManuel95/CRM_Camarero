/**
 * ¿Es un NIF español bien formado? DNI, NIE y NIF de sociedades (antiguo CIF), con su dígito o
 * letra de control. Hacienda rechaza los registros con un NIF del emisor que no cuadra.
 */
const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizarNif(nif: string): string {
  return nif.toUpperCase().replace(/[\s.-]/g, "");
}

export function nifValido(entrada: string): boolean {
  const nif = normalizarNif(entrada);
  // DNI y NIE.
  const persona = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(nif);
  if (persona) {
    const [, prefijo, numero, letra] = persona;
    if (prefijo && numero!.length !== 7) return false;
    if (!prefijo && numero!.length !== 8) return false;
    const n = Number(`${prefijo ? "XYZ".indexOf(prefijo) : ""}${numero}`);
    return LETRAS_DNI[n % 23] === letra;
  }
  // Sociedades y otras entidades.
  const entidad = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif);
  if (!entidad) return false;
  const [, tipo, cifras, control] = entidad;
  let suma = 0;
  [...cifras!].forEach((c, i) => {
    const d = Number(c);
    if (i % 2 === 1) suma += d;
    else {
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    }
  });
  const digito = (10 - (suma % 10)) % 10;
  const letra = "JABCDEFGHI"[digito]!;
  if ("PQRSNW".includes(tipo!)) return control === letra;
  if ("ABEH".includes(tipo!)) return control === String(digito);
  return control === String(digito) || control === letra;
}
