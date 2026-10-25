-- Todos los tickets de un periodo (para la copia de seguridad completa del bar).
create function public.tpv_tickets(
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
    select jsonb_agg(t.datos order by t.fecha, t.secuencia)
    from public.tickets t
    where t.local_id = p_local and t.fecha >= p_desde and t.fecha < p_hasta
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tpv_tickets(text, text, timestamptz, timestamptz)
  from public, authenticated;
grant execute on function public.tpv_tickets(text, text, timestamptz, timestamptz) to anon;
