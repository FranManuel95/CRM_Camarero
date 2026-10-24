-- Comanda en Supabase.
--
-- Nadie lee ni escribe las tablas directamente: tienen RLS activado y ninguna política. El
-- servidor de la app (Vercel) entra solo por las funciones tpv_*, que piden la clave secreta del
-- local (guardada como hash en el esquema `privado`, que no se publica en la API).
-- Los clientes de las mesas nunca hablan con la base de datos: pasan por la app, que comprueba
-- el token de su QR.

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table public.locales (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create table privado.claves (
  local_id text primary key references public.locales (id) on update cascade,
  hash text not null
);

-- Todo lo que está vivo en el local (carta, mesas, cuentas abiertas, caja, gastos, ajustes…)
-- en un documento. `revision` evita que dos pantallas se pisen: se guarda solo si nadie ha
-- cambiado nada desde que se leyó.
create table public.estados (
  local_id text primary key references public.locales (id),
  revision bigint not null default 1,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);

-- Los tickets (facturas simplificadas), uno por fila. Solo se añaden: nunca se cambian.
create table public.tickets (
  local_id text not null references public.locales (id),
  id text not null,
  serie text not null,
  secuencia integer not null check (secuencia > 0),
  fecha timestamptz not null,
  datos jsonb not null,
  primary key (local_id, id),
  unique (local_id, serie, secuencia)
);
create index tickets_local_fecha on public.tickets (local_id, fecha desc);

alter table public.locales enable row level security;
alter table public.estados enable row level security;
alter table public.tickets enable row level security;
alter table privado.claves enable row level security;

revoke all on public.locales, public.estados, public.tickets from anon, authenticated;
-- Ni siquiera el servidor puede cambiar un ticket ya guardado.
revoke all on public.tickets from service_role;
grant select, insert on public.tickets to service_role;

create function privado.clave_valida(p_local text, p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from privado.claves c
    where c.local_id = p_local
      and c.hash = encode(pg_catalog.sha256(convert_to(p_clave, 'UTF8')), 'hex')
  );
$$;
revoke all on function privado.clave_valida(text, text) from public, anon, authenticated;

-- Estado del local y tickets desde `p_desde` (más el último, para encadenar la huella).
-- Devuelve null si el local aún no tiene estado.
create function public.tpv_cargar(p_local text, p_clave text, p_desde timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not privado.clave_valida(p_local, p_clave) then
    raise exception 'Clave del local no válida' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'revision', e.revision,
    'datos', e.datos,
    'tickets', coalesce((
      select jsonb_agg(t.datos order by t.fecha, t.secuencia)
      from public.tickets t
      where t.local_id = p_local
        and (t.fecha >= p_desde or t.id = (
          select u.id from public.tickets u
          where u.local_id = p_local
          order by u.fecha desc, u.secuencia desc
          limit 1))
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.estados e
  where e.local_id = p_local;
  return v_resultado;
end;
$$;

-- Guarda el estado nuevo y los tickets nuevos en la misma transacción. Si otra pantalla ha
-- guardado antes (la revisión no coincide), no guarda nada y devuelve -1 para reintentar.
-- Avisa a las pantallas por Realtime (solo el número de revisión, sin datos).
create function public.tpv_guardar(
  p_local text,
  p_clave text,
  p_revision bigint,
  p_datos jsonb,
  p_tickets jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if not privado.clave_valida(p_local, p_clave) then
    raise exception 'Clave del local no válida' using errcode = '28000';
  end if;
  if p_revision = 0 then
    insert into public.estados (local_id, revision, datos)
    values (p_local, 1, p_datos)
    on conflict (local_id) do nothing
    returning revision into v_revision;
  else
    update public.estados
    set datos = p_datos, revision = revision + 1, actualizado_en = now()
    where local_id = p_local and revision = p_revision
    returning revision into v_revision;
  end if;
  if v_revision is null then
    return -1;
  end if;
  insert into public.tickets (local_id, id, serie, secuencia, fecha, datos)
  select p_local, t ->> 'id', t ->> 'serie', (t ->> 'secuencia')::integer,
         (t ->> 'fecha')::timestamptz, t
  from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) as t;
  perform realtime.send(
    jsonb_build_object('revision', v_revision), 'cambio', 'tpv:' || p_local, false
  );
  return v_revision;
end;
$$;

revoke all on function public.tpv_cargar(text, text, timestamptz) from public, authenticated;
revoke all on function public.tpv_guardar(text, text, bigint, jsonb, jsonb) from public, authenticated;
grant execute on function public.tpv_cargar(text, text, timestamptz) to anon;
grant execute on function public.tpv_guardar(text, text, bigint, jsonb, jsonb) to anon;
