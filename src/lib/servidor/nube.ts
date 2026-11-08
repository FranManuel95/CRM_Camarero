import "server-only";
import { contexto, almacen } from "./almacen";
import { estadoNuevo, type DatosBarNuevo } from "../dominio/nuevo";
import { rpc } from "./supabase-rpc";
import type { Dueno } from "./sesion";

/**
 * Lo que solo existe en la nube: cuentas de dueño (Supabase Auth) y alta de bares.
 * Las contraseñas las guarda y comprueba Supabase; aquí no se guardan nunca.
 */

const auth = (ruta: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/${ruta}`;
const cabeceras = () => ({
  apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  "Content-Type": "application/json",
});

type RespuestaAuth = {
  user?: { id: string; email: string; email_confirmed_at?: string | null };
  id?: string;
  email?: string;
  error_code?: string;
  msg?: string;
  error_description?: string;
};

function errorAuth(r: RespuestaAuth): string {
  const codigo = r.error_code ?? "";
  if (codigo === "invalid_credentials") return "El correo o la contraseña no son correctos.";
  if (codigo === "email_not_confirmed")
    return "Antes de entrar, confirma tu correo con el enlace que te hemos mandado.";
  if (codigo === "user_already_exists" || codigo === "email_exists")
    return "Ya hay una cuenta con ese correo. Entra con ella.";
  if (codigo === "weak_password")
    return "La contraseña es demasiado corta: usa al menos 8 caracteres.";
  if (codigo === "over_email_send_rate_limit" || codigo === "over_request_rate_limit")
    return "Demasiados intentos seguidos. Espera unos minutos.";
  return r.msg ?? r.error_description ?? "No se ha podido completar. Prueba otra vez.";
}

export async function registrar(email: string, clave: string, volverA: string) {
  const r = await fetch(`${auth("signup")}?redirect_to=${encodeURIComponent(volverA)}`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ email, password: clave }),
  });
  const datos = (await r.json()) as RespuestaAuth & { access_token?: string };
  if (!r.ok) return { error: errorAuth(datos) };
  const usuario = datos.user ?? (datos.id ? { id: datos.id, email: datos.email ?? email } : null);
  // Si el proyecto no pide confirmar el correo, ya viene la sesión y se puede entrar.
  return {
    usuario: datos.access_token && usuario ? { id: usuario.id, email: usuario.email } : null,
  };
}

export async function acceder(
  email: string,
  clave: string,
): Promise<{ dueno?: Dueno; error?: string }> {
  const r = await fetch(auth("token?grant_type=password"), {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ email, password: clave }),
  });
  const datos = (await r.json()) as RespuestaAuth;
  if (!r.ok || !datos.user) return { error: errorAuth(datos) };
  return { dueno: { id: datos.user.id, email: datos.user.email } };
}

export async function pedirCambioDeClave(email: string, volverA: string) {
  await fetch(`${auth("recover")}?redirect_to=${encodeURIComponent(volverA)}`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ email }),
  });
}

/** Pone la contraseña nueva con el permiso temporal del enlace del correo. */
export async function cambiarClave(permiso: string, clave: string): Promise<boolean> {
  const r = await fetch(auth("user"), {
    method: "PUT",
    headers: { ...cabeceras(), Authorization: `Bearer ${permiso}` },
    body: JSON.stringify({ password: clave }),
  });
  return r.ok;
}

export type LocalResumen = { id: string; nombre: string; creadoEn: string };

export const localesDe = (dueno: Dueno) =>
  rpc<LocalResumen[]>("tpv_locales_de", { p_propietario: dueno.id });

export type LocalAdmin = LocalResumen & {
  esDemo: boolean;
  propietario: string | null;
  ultimaActividad: string | null;
  tickets30Dias: number;
};
export const listarLocales = () => rpc<LocalAdmin[]>("tpv_listar_locales", {});

/** Por bar: si su dueño tiene más de uno en Comanda. Recordado 10 minutos. */
let variosPorBar: { hasta: number; bares: Map<string, boolean> } | null = null;

/**
 * ¿El dueño de este bar lleva más de una facturación en Comanda? (campo IndicadorMultiplesOT de
 * VERI*FACTU, que se calcula por usuario del programa). Si no se puede saber, «no».
 */
export async function duenoConVariosBares(local: string): Promise<boolean> {
  if (!variosPorBar || variosPorBar.hasta < Date.now()) {
    try {
      const locales = await listarLocales();
      const porDueno = new Map<string, number>();
      for (const l of locales)
        if (l.propietario) porDueno.set(l.propietario, (porDueno.get(l.propietario) ?? 0) + 1);
      variosPorBar = {
        hasta: Date.now() + 10 * 60_000,
        bares: new Map(
          locales.map((l) => [l.id, Boolean(l.propietario && porDueno.get(l.propietario)! > 1)]),
        ),
      };
    } catch {
      return false;
    }
  }
  return variosPorBar.bares.get(local) ?? false;
}

/** Convierte un nombre en identificador: «Bar Paco» → «bar-paco». */
export function identificadorDe(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Da de alta un bar y le guarda su estado inicial. Devuelve el identificador final. */
export async function crearLocal(dueno: Dueno, datos: DatosBarNuevo): Promise<string> {
  const base = identificadorDe(datos.nombre).padEnd(3, "0");
  for (let intento = 0; intento < 6; intento++) {
    const id =
      intento === 0 ? base : `${base.slice(0, 35)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const creado = await rpc<boolean>("tpv_crear_local", {
      p_local: id,
      p_nombre: datos.nombre,
      p_propietario: dueno.id,
    });
    if (!creado) continue;
    await almacen(id).iniciar!(estadoNuevo(contexto(), datos));
    return id;
  }
  throw new Error("No se ha podido crear el bar. Prueba con otro nombre.");
}
