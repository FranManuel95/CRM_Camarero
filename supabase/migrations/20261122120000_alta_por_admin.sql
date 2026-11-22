-- Las altas de bares las hace quien vende Comanda (ADMIN_EMAILS), para la cuenta de cada dueño.
-- Para saber si un correo ya tiene cuenta (y añadirle el bar) o hay que crearla.
-- Solo con la clave del servidor, como el resto de funciones tpv_.
create function public.tpv_dueno_por_correo(p_clave text, p_correo text)
returns uuid
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
    select u.id from auth.users u
    where lower(u.email) = lower(trim(p_correo))
    limit 1
  );
end;
$$;

revoke all on function public.tpv_dueno_por_correo(text, text) from public, authenticated;
grant execute on function public.tpv_dueno_por_correo(text, text) to anon;
