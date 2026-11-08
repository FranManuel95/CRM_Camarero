-- Copias nocturnas de cada bar, hechas por la propia base de datos (pg_cron): cada noche se
-- guarda el documento del bar (carta, mesas, equipo, clientes, stock, ajustes, cuentas…) si ha
-- cambiado desde la última copia. Se guardan 30 días. Los tickets y los fichajes no hace falta
-- copiarlos aquí: van en sus propias tablas, solo se añaden y nunca se reescriben.

create extension if not exists pg_cron;

create table privado.copias (
  local_id text not null references public.locales (id) on delete cascade,
  dia date not null,
  creada timestamptz not null default now(),
  revision bigint not null,
  datos jsonb not null,
  primary key (local_id, dia)
);
alter table privado.copias enable row level security;

create or replace function privado.copiar_estados()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hechas integer;
begin
  insert into privado.copias (local_id, dia, revision, datos)
  select e.local_id, (now() at time zone 'Europe/Madrid')::date, e.revision, e.datos
  from public.estados e
  where e.revision is distinct from (
    select c.revision from privado.copias c
    where c.local_id = e.local_id
    order by c.dia desc
    limit 1)
  on conflict (local_id, dia) do update
    set revision = excluded.revision, datos = excluded.datos, creada = now();
  get diagnostics v_hechas = row_count;
  -- Se borran las de hace más de 30 días, pero cada bar conserva siempre su última copia.
  delete from privado.copias c
  where c.dia < (now() at time zone 'Europe/Madrid')::date - 30
    and c.dia < (select max(u.dia) from privado.copias u where u.local_id = c.local_id);
  return v_hechas;
end;
$$;
revoke all on function privado.copiar_estados() from public, anon, authenticated;

-- A las 3:23 (hora de España en invierno; 4:23 en verano), cuando ningún bar está abierto.
select cron.schedule('copias-nocturnas', '23 2 * * *', 'select privado.copiar_estados()');

-- Las copias de un bar (sin los datos), de la más reciente a la más antigua.
create or replace function public.tpv_copias(p_local text, p_clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.clave_valida(p_local, p_clave) then
    raise exception 'Clave del local no válida' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object('dia', c.dia, 'creada', c.creada, 'bytes', pg_column_size(c.datos))
      order by c.dia desc)
    from privado.copias c
    where c.local_id = p_local
  ), '[]'::jsonb);
end;
$$;

-- Una copia concreta, con sus datos.
create or replace function public.tpv_copia(p_local text, p_clave text, p_dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.clave_valida(p_local, p_clave) then
    raise exception 'Clave del local no válida' using errcode = '28000';
  end if;
  return (
    select jsonb_build_object('dia', c.dia, 'creada', c.creada, 'datos', c.datos)
    from privado.copias c
    where c.local_id = p_local and c.dia = p_dia
  );
end;
$$;

revoke all on function public.tpv_copias(text, text) from public, authenticated;
revoke all on function public.tpv_copia(text, text, date) from public, authenticated;
grant execute on function public.tpv_copias(text, text) to anon;
grant execute on function public.tpv_copia(text, text, date) to anon;

-- La primera, ya.
select privado.copiar_estados();
