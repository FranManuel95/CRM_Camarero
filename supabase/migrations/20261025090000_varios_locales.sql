-- Varios bares en la misma base de datos.
--
-- Antes cada bar tenía su propia clave. Ahora la app (Vercel) tiene una sola clave de servidor y
-- atiende a todos los bares; quién puede tocar cada bar lo decide la app (cuenta del dueño, PIN
-- del equipo o token del QR). En la base de datos solo está el resumen SHA-256 de la clave.

create table privado.servidor (
  id boolean primary key default true check (id),
  hash text not null
);
alter table privado.servidor enable row level security;

-- La clave del bar de demostración pasa a ser la del servidor (es la que ya tiene Vercel).
insert into privado.servidor (hash)
select hash from privado.claves where local_id = 'la-esquina';

-- privado.claves se queda sin uso (ya no la lee ninguna función).

alter table public.locales
  add column propietario uuid references auth.users (id),
  add column es_demo boolean not null default false;
update public.locales set es_demo = true where id = 'la-esquina';
create index locales_propietario on public.locales (propietario);

create or replace function privado.servidor_valido(p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from privado.servidor s
    where s.hash = encode(pg_catalog.sha256(convert_to(p_clave, 'UTF8')), 'hex')
  );
$$;
revoke all on function privado.servidor_valido(text) from public, anon, authenticated;

-- Las funciones de antes siguen llamando a clave_valida: ahora vale la clave del servidor para
-- cualquier bar que exista.
create or replace function privado.clave_valida(p_local text, p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.servidor_valido(p_clave)
     and exists (select 1 from public.locales l where l.id = p_local);
$$;

-- Da de alta un bar. Devuelve false si el identificador ya está cogido.
create function public.tpv_crear_local(
  p_clave text,
  p_local text,
  p_nombre text,
  p_propietario uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  insert into public.locales (id, nombre, propietario)
  values (p_local, p_nombre, p_propietario)
  on conflict (id) do nothing;
  return found;
end;
$$;

-- Los bares de un dueño.
create function public.tpv_locales_de(p_clave text, p_propietario uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'creadoEn', l.creado_en)
                     order by l.creado_en)
    from public.locales l
    where l.propietario = p_propietario
  ), '[]'::jsonb);
end;
$$;

-- Para el panel de quien vende Comanda: todos los bares con su dueño y su actividad.
create function public.tpv_listar_locales(p_clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'nombre', l.nombre,
      'esDemo', l.es_demo,
      'creadoEn', l.creado_en,
      'propietario', u.email,
      'ultimaActividad', e.actualizado_en,
      'tickets30Dias', (
        select count(*) from public.tickets t
        where t.local_id = l.id and t.fecha > now() - interval '30 days'
      )
    ) order by l.creado_en desc)
    from public.locales l
    left join auth.users u on u.id = l.propietario
    left join public.estados e on e.local_id = l.id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tpv_crear_local(text, text, text, uuid) from public, authenticated;
revoke all on function public.tpv_locales_de(text, uuid) from public, authenticated;
revoke all on function public.tpv_listar_locales(text) from public, authenticated;
grant execute on function public.tpv_crear_local(text, text, text, uuid) to anon;
grant execute on function public.tpv_locales_de(text, uuid) to anon;
grant execute on function public.tpv_listar_locales(text) to anon;
