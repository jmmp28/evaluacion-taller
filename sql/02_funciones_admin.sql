-- =====================================================================
--  EVALUACIÓN DEL TALLER · funciones de administración (2.º script)
--  Ejecútalo DESPUÉS de 01_evaluacion_esquema.sql, en el SQL Editor.
--  Permiten al administrador, desde la web, ver los profesores con su
--  correo y dar de alta a uno nuevo escribiendo su correo.
-- =====================================================================

-- Lista de profesores con su correo (sólo administradores)
create or replace function evaluacion.lista_profesores()
returns table (user_id uuid, email text, nombre text, rol text, activo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not evaluacion.es_admin() then
    raise exception 'Sólo un administrador puede ver la lista de profesores';
  end if;
  return query
    select p.user_id, u.email::text, p.nombre, p.rol, p.activo
    from evaluacion.profesores p
    join auth.users u on u.id = p.user_id
    order by p.activo desc, p.nombre;
end $$;

-- Dar de alta (o reactivar) a un profesor por su correo (sólo administradores).
-- La cuenta tiene que existir ya en Authentication (la del Inventario sirve).
create or replace function evaluacion.alta_profesor(p_email text, p_nombre text, p_rol text default 'profesor')
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not evaluacion.es_admin() then
    raise exception 'Sólo un administrador puede dar de alta profesores';
  end if;
  if p_rol not in ('admin', 'profesor') then
    raise exception 'Rol no válido: %', p_rol;
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Falta el nombre';
  end if;
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Ese correo no tiene cuenta. Créala en Supabase → Authentication → Users (o que entre antes en el Inventario).';
  end if;
  insert into evaluacion.profesores (user_id, nombre, rol, activo)
  values (v_id, trim(p_nombre), p_rol, true)
  on conflict (user_id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;
  return v_id;
end $$;

revoke all on function evaluacion.lista_profesores() from public, anon;
revoke all on function evaluacion.alta_profesor(text, text, text) from public, anon;
grant execute on function evaluacion.lista_profesores() to authenticated;
grant execute on function evaluacion.alta_profesor(text, text, text) to authenticated;
