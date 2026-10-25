-- Fotos de los platos (Supabase Storage).
--
-- El bucket es público para leer (las fotos salen en la carta QR). Para subir, la app pide antes
-- un permiso para una ruta concreta (tpv_permitir_subida, con la clave del servidor) y el
-- navegador del encargado sube directamente esa foto. Sin permiso vigente no se puede subir nada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table privado.subidas (
  ruta text primary key,
  caduca timestamptz not null
);
alter table privado.subidas enable row level security;

-- Lo llama la app (Vercel) con la clave del servidor: permite subir esa ruta durante 10 minutos.
create function public.tpv_permitir_subida(p_clave text, p_ruta text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.servidor_valido(p_clave) then
    raise exception 'Clave del servidor no válida' using errcode = '28000';
  end if;
  if p_ruta !~ '^[a-z0-9-]{3,40}/[a-f0-9-]{36}\.(webp|jpg|png)$' then
    raise exception 'Ruta no válida' using errcode = '22023';
  end if;
  insert into privado.subidas (ruta, caduca) values (p_ruta, now() + interval '10 minutes')
  on conflict (ruta) do update set caduca = excluded.caduca;
  return true;
end;
$$;
revoke all on function public.tpv_permitir_subida(text, text) from public, authenticated;
grant execute on function public.tpv_permitir_subida(text, text) to anon;

-- Lo usa la política de Storage: ¿hay un permiso vigente para esta ruta?
create function public.tpv_subida_permitida(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from privado.subidas s where s.ruta = p_ruta and s.caduca > now());
$$;
revoke all on function public.tpv_subida_permitida(text) from public, authenticated;
grant execute on function public.tpv_subida_permitida(text) to anon;

create policy "Subir fotos con permiso"
on storage.objects for insert to anon
with check (bucket_id = 'fotos' and public.tpv_subida_permitida(name));
