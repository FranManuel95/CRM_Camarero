-- Registro de jornada (fichajes). Hay que guardarlo cuatro años, así que no va en el documento
-- del bar (que se lee y se escribe en cada acción): va en su propia tabla, una fila por fichaje.
-- Una corrección sustituye la fila, pero el fichaje lleva dentro la lista de cambios (quién,
-- cuándo, por qué y qué había antes).

create table public.fichajes (
  local_id text not null references public.locales (id),
  id text not null,
  empleado_id text not null,
  entrada timestamptz not null,
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (local_id, id)
);
create index fichajes_local_entrada on public.fichajes (local_id, entrada);
alter table public.fichajes enable row level security;

-- Igual que antes, y además los fichajes recientes y los que siguen abiertos.
create or replace function public.tpv_cargar(p_local text, p_clave text, p_desde timestamptz)
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

-- Como tpv_guardar, y además guarda los fichajes nuevos o cambiados. La función de antes se
-- queda para que la versión anterior de la app siga funcionando mientras se publica esta.
create function public.tpv_guardar_v2(
  p_local text,
  p_clave text,
  p_revision bigint,
  p_datos jsonb,
  p_tickets jsonb,
  p_fichajes jsonb
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
  insert into public.fichajes (local_id, id, empleado_id, entrada, datos)
  select p_local, f ->> 'id', f ->> 'empleadoId', (f ->> 'entrada')::timestamptz, f
  from jsonb_array_elements(coalesce(p_fichajes, '[]'::jsonb)) as f
  on conflict (local_id, id) do update
    set datos = excluded.datos, entrada = excluded.entrada, actualizado_en = now();
  perform realtime.send(
    jsonb_build_object('revision', v_revision), 'cambio', 'tpv:' || p_local, false
  );
  return v_revision;
end;
$$;

-- Los fichajes de un periodo (para el registro de jornada que se descarga).
create function public.tpv_fichajes(
  p_local text,
  p_clave text,
  p_desde timestamptz,
  p_hasta timestamptz
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
    select jsonb_agg(f.datos order by f.entrada)
    from public.fichajes f
    where f.local_id = p_local and f.entrada >= p_desde and f.entrada < p_hasta
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tpv_guardar_v2(text, text, bigint, jsonb, jsonb, jsonb)
  from public, authenticated;
revoke all on function public.tpv_fichajes(text, text, timestamptz, timestamptz)
  from public, authenticated;
grant execute on function public.tpv_guardar_v2(text, text, bigint, jsonb, jsonb, jsonb) to anon;
grant execute on function public.tpv_fichajes(text, text, timestamptz, timestamptz) to anon;
