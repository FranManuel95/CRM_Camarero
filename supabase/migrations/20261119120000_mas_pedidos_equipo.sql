-- Lo que más pide cada persona del equipo (para su pestaña «Rápidos»): por cada empleado, los
-- productos de sus tickets de los últimos días, del más pedido al menos. Con p_hora, solo a esa
-- hora (una arriba o abajo, hora de Madrid); sin ella, el día entero.

create or replace function public.tpv_mas_pedidos_equipo(
  p_local text,
  p_clave text,
  p_hora integer,
  p_dias integer default 28,
  p_cuantos integer default 8
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
    select jsonb_object_agg(z.empleado, z.nombres)
    from (
      select y.empleado, jsonb_agg(y.nombre order by y.unidades desc) as nombres
      from (
        select x.*, row_number() over (partition by x.empleado order by x.unidades desc) as puesto
        from (
          select t.datos ->> 'empleadoId' as empleado,
                 l ->> 'producto' as nombre,
                 sum((l ->> 'cantidad')::numeric) as unidades
          from public.tickets t
          cross join lateral jsonb_array_elements(t.datos -> 'lineas') as l
          where t.local_id = p_local
            and t.fecha >= now() - make_interval(days => least(greatest(p_dias, 1), 90))
            and t.datos ->> 'empleadoId' is not null
            and (t.datos ->> 'total')::numeric > 0
            and (l ->> 'cantidad')::numeric > 0
            and (
              p_hora is null
              or least(
                abs(extract(hour from t.fecha at time zone 'Europe/Madrid')::integer - p_hora),
                24 - abs(extract(hour from t.fecha at time zone 'Europe/Madrid')::integer - p_hora)
              ) <= 1
            )
          group by 1, 2
        ) x
      ) y
      where y.puesto <= least(greatest(p_cuantos, 1), 30)
      group by y.empleado
    ) z
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.tpv_mas_pedidos_equipo(text, text, integer, integer, integer)
  from public, authenticated;
grant execute on function public.tpv_mas_pedidos_equipo(text, text, integer, integer, integer)
  to anon;
