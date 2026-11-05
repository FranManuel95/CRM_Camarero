-- Carga ligera del bar: la app ya no trae 62 días de tickets en cada acción ni en cada recarga.
-- Trae los de las últimas horas y, para numerar sin huecos, el último ticket de cada serie. Lo
-- demás se pide cuando hace falta: tickets sueltos (rectificar, reimprimir), lo más pedido
-- (pestaña «Rápidos») e informes (tpv_tickets, que ya existía).

create or replace function public.tpv_cargar_v3(p_local text, p_clave text, p_desde timestamptz)
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
    ), '[]'::jsonb),
    -- El último de cada serie (para seguir la numeración aunque no esté entre los de arriba).
    'ultimos', coalesce((
      select jsonb_agg(x.datos)
      from (
        select distinct on (t.serie) t.datos
        from public.tickets t
        where t.local_id = p_local
        order by t.serie, t.secuencia desc
      ) x
    ), '[]'::jsonb),
    'fichajes', coalesce((
      select jsonb_agg(f.datos order by f.entrada)
      from public.fichajes f
      where f.local_id = p_local
        and (f.entrada >= p_desde or f.datos ->> 'salida' is null)
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.estados e
  where e.local_id = p_local;
  return v_resultado;
end;
$$;

-- Tickets sueltos por su id (para rectificar o reimprimir uno antiguo).
create or replace function public.tpv_tickets_por_id(p_local text, p_clave text, p_ids text[])
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
    select jsonb_agg(t.datos order by t.fecha, t.secuencia)
    from public.tickets t
    where t.local_id = p_local and t.id = any (p_ids[1:50])
  ), '[]'::jsonb);
end;
$$;

-- Lo más pedido en los últimos días a una hora (una arriba o abajo, hora de Madrid), o en todo
-- el día si p_hora es null. Devuelve los nombres de producto, del más pedido al menos.
create or replace function public.tpv_mas_pedidos(
  p_local text,
  p_clave text,
  p_hora integer,
  p_dias integer default 28,
  p_cuantos integer default 12
)
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
    select jsonb_agg(x.nombre order by x.unidades desc)
    from (
      select l ->> 'producto' as nombre, sum((l ->> 'cantidad')::numeric) as unidades
      from public.tickets t
      cross join lateral jsonb_array_elements(t.datos -> 'lineas') as l
      where t.local_id = p_local
        and t.fecha >= now() - make_interval(days => least(greatest(p_dias, 1), 90))
        and (t.datos ->> 'total')::numeric > 0
        and (l ->> 'cantidad')::numeric > 0
        and (
          p_hora is null
          or least(
            abs(extract(hour from t.fecha at time zone 'Europe/Madrid')::integer - p_hora),
            24 - abs(extract(hour from t.fecha at time zone 'Europe/Madrid')::integer - p_hora)
          ) <= 1
        )
      group by 1
      order by 2 desc
      limit least(greatest(p_cuantos, 1), 50)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Intentos (PIN, códigos de vinculación…): contados en la base de datos para que valgan igual
-- en todos los servidores de la app, no solo en el que recibe cada intento.
create table privado.intentos (
  clave text not null,
  en timestamptz not null default now()
);
create index intentos_clave_en on privado.intentos (clave, en);
alter table privado.intentos enable row level security;

-- Apunta un intento y dice si aún se puede (true) o si ya van demasiados en la ventana (false).
create or replace function public.tpv_intento(
  p_clave text,
  p_quien text,
  p_maximo integer,
  p_segundos integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cuantos integer;
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  -- Limpieza de paso: lo de hace más de un día ya no cuenta para nada.
  delete from privado.intentos where en < now() - interval '1 day';
  select count(*) into v_cuantos
  from privado.intentos
  where clave = left(p_quien, 200) and en > now() - make_interval(secs => p_segundos);
  if v_cuantos >= p_maximo then
    return false;
  end if;
  insert into privado.intentos (clave) values (left(p_quien, 200));
  return true;
end;
$$;

-- Cuántos intentos van en la ventana, sin apuntar uno nuevo (para mirar antes de comprobar un PIN).
create or replace function public.tpv_intentos(p_clave text, p_quien text, p_segundos integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  return (
    select count(*)::integer from privado.intentos
    where clave = left(p_quien, 200) and en > now() - make_interval(secs => p_segundos)
  );
end;
$$;

revoke all on function public.tpv_intentos(text, text, integer) from public, authenticated;
grant execute on function public.tpv_intentos(text, text, integer) to anon;
revoke all on function public.tpv_cargar_v3(text, text, timestamptz) from public, authenticated;
revoke all on function public.tpv_tickets_por_id(text, text, text[]) from public, authenticated;
revoke all on function public.tpv_mas_pedidos(text, text, integer, integer, integer)
  from public, authenticated;
revoke all on function public.tpv_intento(text, text, integer, integer) from public, authenticated;
grant execute on function public.tpv_cargar_v3(text, text, timestamptz) to anon;
grant execute on function public.tpv_tickets_por_id(text, text, text[]) to anon;
grant execute on function public.tpv_mas_pedidos(text, text, integer, integer, integer) to anon;
grant execute on function public.tpv_intento(text, text, integer, integer) to anon;
