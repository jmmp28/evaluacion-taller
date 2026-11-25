-- =====================================================================
--  EVALUACIÓN DEL TALLER · centros y superadministrador (3.er script)
--  Ejecútalo DESPUÉS de 01 y 02, en el SQL Editor, UNA sola vez.
--
--  Qué hace:
--   · Crea los CENTROS: «ACE Vista Alegre» y «ACE Pío Baroja». Cada
--     centro tiene sus grupos, profesores, actividades y observaciones,
--     y no ve nada de los demás.
--   · Todo lo que ya existe (tu taller) pasa a «ACE Vista Alegre».
--   · «ACE Pío Baroja» queda vacío, preparado para cuando tenga talleres.
--   · Tres papeles:
--       superadmin → lo ve y lo gestiona todo: centros, grupos, cuentas.
--       admin      → ve todos los grupos de SU centro (no da altas).
--       profesor   → sólo los grupos que tenga asignados.
--   · admin@instituto.es pasa a ser admin del centro ACE Pío Baroja (y
--     deja de ver los grupos de Vista Alegre: tú entras con tu cuenta).
--   · Permite al superadmin crear cuentas desde la web (correo +
--     contraseña inicial) y ponerles una contraseña nueva. Esas cuentas
--     NO tienen acceso al Inventario (ver sección 6).
--
--  ANTES DE EJECUTARLO cambia en la sección 7 (al final) tu correo,
--  tu nombre y, si tu cuenta aún no existe, una contraseña inicial.
--
--  No cambia nada del Inventario (sólo evita que las cuentas nuevas de
--  la evaluación reciban un perfil allí). Si algo falla, no se cambia
--  nada (va todo dentro de una transacción).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. CENTROS
-- ---------------------------------------------------------------------
create table evaluacion.centros (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);
insert into evaluacion.centros (nombre) values ('ACE Vista Alegre');   -- el Pío Baroja se crea en la sección 7

-- ---------------------------------------------------------------------
-- 2. CADA COSA, EN SU CENTRO (lo que ya hay → ACE Vista Alegre)
-- ---------------------------------------------------------------------
do $$
declare
  v_va bigint := (select id from evaluacion.centros where nombre = 'ACE Vista Alegre');
  t text;
begin
  foreach t in array array['grupos', 'categorias', 'proyectos', 'observaciones', 'observacion_por_nota'] loop
    execute format('alter table evaluacion.%I add column centro_id bigint references evaluacion.centros (id) on delete restrict', t);
    execute format('update evaluacion.%I set centro_id = %s', t, v_va);
    execute format('alter table evaluacion.%I alter column centro_id set not null', t);
    execute format('create index on evaluacion.%I (centro_id)', t);
  end loop;

  alter table evaluacion.profesores add column centro_id bigint references evaluacion.centros (id) on delete restrict;
  update evaluacion.profesores set centro_id = v_va;
end $$;

-- los nombres sólo tienen que ser únicos dentro de cada centro
alter table evaluacion.grupos        drop constraint if exists grupos_nombre_curso_key;
alter table evaluacion.grupos        add unique (centro_id, nombre, curso);
alter table evaluacion.categorias    drop constraint if exists categorias_nombre_key;
alter table evaluacion.categorias    add unique (centro_id, nombre);
alter table evaluacion.proyectos     drop constraint if exists proyectos_nombre_key;
alter table evaluacion.proyectos     add unique (centro_id, nombre);
alter table evaluacion.observaciones drop constraint if exists observaciones_texto_key;
alter table evaluacion.observaciones add unique (centro_id, texto);
alter table evaluacion.observacion_por_nota drop constraint if exists observacion_por_nota_pkey;
alter table evaluacion.observacion_por_nota add primary key (centro_id, nota);

-- papeles
alter table evaluacion.profesores drop constraint if exists profesores_rol_check;
alter table evaluacion.profesores add constraint profesores_rol_check check (rol in ('superadmin', 'admin', 'profesor'));
-- el superadmin no es de ningún centro; los demás, de uno
alter table evaluacion.profesores add constraint profesores_centro_check
  check ((rol = 'superadmin') = (centro_id is null));

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE PERMISOS
-- ---------------------------------------------------------------------
create or replace function evaluacion.es_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo and p.rol = 'superadmin');
$$;

-- superadmin, o admin de algún centro
create or replace function evaluacion.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo and p.rol in ('superadmin', 'admin'));
$$;

-- ¿trabaja el usuario en este centro?
create or replace function evaluacion.puede_centro(c bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select evaluacion.es_superadmin()
      or exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo and p.centro_id = c);
$$;

-- ¿es admin de este centro (o superadmin)?
create or replace function evaluacion.admin_centro(c bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select evaluacion.es_superadmin()
      or exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo and p.rol = 'admin' and p.centro_id = c);
$$;

create or replace function evaluacion.centro_de_grupo(g bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select gr.centro_id from evaluacion.grupos gr where gr.id = g;
$$;

create or replace function evaluacion.centro_de_categoria(c bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select ca.centro_id from evaluacion.categorias ca where ca.id = c;
$$;

-- superadmin: todos · admin: los de su centro · profesor: los asignados (de su centro)
create or replace function evaluacion.puede_grupo(g bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select evaluacion.es_superadmin()
      or exists (select 1
                 from evaluacion.grupos gr
                 join evaluacion.profesores p on p.user_id = auth.uid() and p.activo and p.centro_id = gr.centro_id
                 where gr.id = g
                   and (p.rol = 'admin'
                        or exists (select 1 from evaluacion.grupo_profesores gp
                                   where gp.grupo_id = g and gp.user_id = p.user_id)));
$$;

-- una tarea (o un proyecto, o una categoría) sólo se puede usar en grupos de su centro
create or replace function evaluacion.tarea_del_centro(t bigint, c bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select t is null or exists (select 1 from evaluacion.tareas ta
                              join evaluacion.categorias ca on ca.id = ta.categoria_id
                              where ta.id = t and ca.centro_id = c);
$$;
create or replace function evaluacion.proyecto_del_centro(p bigint, c bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select p is null or exists (select 1 from evaluacion.proyectos pr where pr.id = p and pr.centro_id = c);
$$;
create or replace function evaluacion.categoria_del_centro(x bigint, c bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select x is null or exists (select 1 from evaluacion.categorias ca where ca.id = x and ca.centro_id = c);
$$;

-- ---------------------------------------------------------------------
-- 4. REGLAS (RLS): se cambian las antiguas por las de centros
-- ---------------------------------------------------------------------
alter table evaluacion.centros enable row level security;

drop policy if exists "ver profesores"             on evaluacion.profesores;
drop policy if exists "admin gestiona profesores"  on evaluacion.profesores;
drop policy if exists "ver grupos"                 on evaluacion.grupos;
drop policy if exists "admin gestiona grupos"      on evaluacion.grupos;
drop policy if exists "ver asignaciones"           on evaluacion.grupo_profesores;
drop policy if exists "admin asigna grupos"        on evaluacion.grupo_profesores;
drop policy if exists "sesiones del grupo"         on evaluacion.sesiones;
drop policy if exists "prevision del grupo"        on evaluacion.prevision;
drop policy if exists "fotos del grupo"            on evaluacion.fotos;
do $$
declare t text;
begin
  foreach t in array array['categorias', 'proyectos', 'tareas', 'observaciones', 'observacion_por_nota'] loop
    execute format('drop policy if exists "ver %1$s" on evaluacion.%1$I', t);
    execute format('drop policy if exists "añadir %1$s" on evaluacion.%1$I', t);
    execute format('drop policy if exists "cambiar %1$s" on evaluacion.%1$I', t);
    execute format('drop policy if exists "borrar %1$s" on evaluacion.%1$I', t);
  end loop;
end $$;

-- centros: cada uno ve el suyo; el superadmin, todos y los gestiona
create policy "ver centros" on evaluacion.centros for select to authenticated
  using (evaluacion.puede_centro(id));
create policy "superadmin gestiona centros" on evaluacion.centros for all to authenticated
  using (evaluacion.es_superadmin()) with check (evaluacion.es_superadmin());

-- profesores: uno mismo; el admin ve los de su centro; el superadmin gestiona
create policy "ver profesores" on evaluacion.profesores for select to authenticated
  using (user_id = auth.uid() or evaluacion.es_superadmin()
         or (centro_id is not null and evaluacion.admin_centro(centro_id)));
create policy "superadmin gestiona profesores" on evaluacion.profesores for all to authenticated
  using (evaluacion.es_superadmin()) with check (evaluacion.es_superadmin());

-- grupos: los que puede usar; sólo el superadmin los crea
create policy "ver grupos" on evaluacion.grupos for select to authenticated
  using (evaluacion.puede_grupo(id));
create policy "superadmin gestiona grupos" on evaluacion.grupos for all to authenticated
  using (evaluacion.es_superadmin()) with check (evaluacion.es_superadmin());

-- asignaciones: sólo el superadmin, y sólo dentro del mismo centro
create policy "ver asignaciones" on evaluacion.grupo_profesores for select to authenticated
  using (user_id = auth.uid() or evaluacion.admin_centro(evaluacion.centro_de_grupo(grupo_id)));
create policy "superadmin asigna grupos" on evaluacion.grupo_profesores for all to authenticated
  using (evaluacion.es_superadmin())
  with check (evaluacion.es_superadmin() and exists (
    select 1 from evaluacion.profesores p
    where p.user_id = grupo_profesores.user_id and p.centro_id = evaluacion.centro_de_grupo(grupo_id)));

-- sesiones, previsión y fotos: del grupo propio, con actividades de su centro
create policy "sesiones del grupo" on evaluacion.sesiones for all to authenticated
  using (evaluacion.puede_grupo(grupo_id))
  with check (evaluacion.puede_grupo(grupo_id)
              and evaluacion.tarea_del_centro(tarea_id, evaluacion.centro_de_grupo(grupo_id)));
create policy "prevision del grupo" on evaluacion.prevision for all to authenticated
  using (evaluacion.puede_grupo(grupo_id))
  with check (evaluacion.puede_grupo(grupo_id)
              and evaluacion.proyecto_del_centro(proyecto_id, evaluacion.centro_de_grupo(grupo_id))
              and evaluacion.categoria_del_centro(categoria_id, evaluacion.centro_de_grupo(grupo_id))
              and evaluacion.tarea_del_centro(tarea_id, evaluacion.centro_de_grupo(grupo_id)));
create policy "fotos del grupo" on evaluacion.fotos for all to authenticated
  using (evaluacion.puede_grupo(grupo_id))
  with check (evaluacion.puede_grupo(grupo_id)
              and evaluacion.proyecto_del_centro(proyecto_id, evaluacion.centro_de_grupo(grupo_id)));
-- («alumnos del grupo» y «evaluaciones del grupo» siguen igual: usan puede_grupo)

-- catálogo de cada centro: sus profesores lo ven y añaden; su admin borra
do $$
declare t text;
begin
  foreach t in array array['categorias', 'proyectos', 'observaciones', 'observacion_por_nota'] loop
    execute format('create policy "ver %1$s" on evaluacion.%1$I for select to authenticated using (evaluacion.puede_centro(centro_id))', t);
    execute format('create policy "añadir %1$s" on evaluacion.%1$I for insert to authenticated with check (evaluacion.puede_centro(centro_id))', t);
    execute format('create policy "cambiar %1$s" on evaluacion.%1$I for update to authenticated using (evaluacion.puede_centro(centro_id)) with check (evaluacion.puede_centro(centro_id))', t);
    execute format('create policy "borrar %1$s" on evaluacion.%1$I for delete to authenticated using (evaluacion.admin_centro(centro_id))', t);
  end loop;
end $$;

-- tareas: el centro es el de su categoría (y el proyecto tiene que ser del mismo)
create policy "ver tareas" on evaluacion.tareas for select to authenticated
  using (evaluacion.puede_centro(evaluacion.centro_de_categoria(categoria_id)));
create policy "añadir tareas" on evaluacion.tareas for insert to authenticated
  with check (evaluacion.puede_centro(evaluacion.centro_de_categoria(categoria_id))
              and evaluacion.proyecto_del_centro(proyecto_id, evaluacion.centro_de_categoria(categoria_id)));
create policy "cambiar tareas" on evaluacion.tareas for update to authenticated
  using (evaluacion.puede_centro(evaluacion.centro_de_categoria(categoria_id)))
  with check (evaluacion.puede_centro(evaluacion.centro_de_categoria(categoria_id))
              and evaluacion.proyecto_del_centro(proyecto_id, evaluacion.centro_de_categoria(categoria_id)));
create policy "borrar tareas" on evaluacion.tareas for delete to authenticated
  using (evaluacion.admin_centro(evaluacion.centro_de_categoria(categoria_id)));

grant select, insert, update, delete on evaluacion.centros to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. CENTRO NUEVO → con la lista de observaciones de siempre
-- ---------------------------------------------------------------------
create or replace function evaluacion.sembrar_centro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into evaluacion.observaciones (centro_id, texto, orden)
  select new.id, x.texto, x.orden from (values
    ('Trabaja bien', 1), ('Trabajo correcto', 2), ('Participa activamente', 3),
    ('Muy buena actitud', 4), ('Ha mejorado', 5), ('Le cuesta, necesita apoyo', 6),
    ('No trabaja', 7), ('No trae el material', 8), ('No ha hecho la tarea', 9),
    ('Se distrae', 10), ('Habla / interrumpe', 11), ('Llega tarde', 12),
    ('Uso indebido del móvil', 13), ('Ausencia justificada', 14),
    ('Ausencia sin justificar', 15), ('Expulsado del aula', 16)) as x (texto, orden);
  insert into evaluacion.observacion_por_nota (centro_id, nota, observacion) values
    (new.id, '3', 'Trabaja bien'), (new.id, '2', 'Trabajo correcto'),
    (new.id, '1', 'Le cuesta, necesita apoyo'), (new.id, '0', 'No trabaja'), (new.id, 'A', null);
  return new;
end $$;

create trigger centros_sembrar after insert on evaluacion.centros
  for each row execute function evaluacion.sembrar_centro();

-- ---------------------------------------------------------------------
-- 6. CUENTAS Y PROFESORES (sólo el superadmin, desde la web)
-- ---------------------------------------------------------------------
-- Crea una cuenta de acceso. Interna: no se puede llamar desde la web.
-- OJO, INVENTARIO: su trigger «on_auth_user_created» (handle_new_user) da a
-- toda cuenta nueva un perfil del Inventario con rol «usuario». Las cuentas
-- creadas aquí son sólo para la evaluación, así que justo después se quita
-- ese perfil (sólo el de esa cuenta nueva). El Inventario no se modifica:
-- si algún día un profesor necesita entrar también allí, se le da de alta
-- desde el propio Inventario.
create or replace function evaluacion._crear_cuenta(p_email text, p_clave text, p_nombre text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido: %', p_email; end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          '{"provider": "email", "providers": ["email"]}',
          jsonb_build_object('nombre', coalesce(trim(p_nombre), ''), 'origen', 'evaluacion'), now(), now(),
          '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  -- sin acceso al Inventario (ver arriba)
  if to_regclass('public.perfiles') is not null then
    execute 'delete from public.perfiles where id = $1' using v_id;
  end if;
  return v_id;
end $$;
revoke all on function evaluacion._crear_cuenta(text, text, text) from public, anon, authenticated;

-- Lista de profesores con su correo y centro
drop function if exists evaluacion.lista_profesores();
create function evaluacion.lista_profesores()
returns table (user_id uuid, email text, nombre text, rol text, activo boolean, centro_id bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not evaluacion.es_superadmin() then
    raise exception 'Sólo el superadministrador puede ver la lista de profesores';
  end if;
  return query
    select p.user_id, u.email::text, p.nombre, p.rol, p.activo, p.centro_id
    from evaluacion.profesores p
    join auth.users u on u.id = p.user_id
    order by p.activo desc, p.nombre;
end $$;

-- Dar de alta o cambiar a un profesor. Si el correo no tiene cuenta, la crea
-- con la contraseña inicial (obligatoria en ese caso). Si ya la tiene (por
-- ejemplo, la del Inventario), conserva su contraseña.
drop function if exists evaluacion.alta_profesor(text, text, text);
create function evaluacion.alta_profesor(p_email text, p_nombre text, p_rol text,
                                         p_centro bigint default null, p_clave text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not evaluacion.es_superadmin() then
    raise exception 'Sólo el superadministrador puede dar de alta profesores';
  end if;
  if p_rol not in ('superadmin', 'admin', 'profesor') then raise exception 'Papel no válido: %', p_rol; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  if p_rol <> 'superadmin' and p_centro is null then raise exception 'Elige el centro'; end if;
  if p_rol = 'superadmin' then p_centro := null; end if;

  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    if coalesce(p_clave, '') = '' then
      raise exception 'Ese correo aún no tiene cuenta: escribe una contraseña inicial para crearla';
    end if;
    v_id := evaluacion._crear_cuenta(p_email, p_clave, p_nombre);
  end if;

  if v_id = auth.uid() and p_rol <> 'superadmin' then
    raise exception 'No puedes quitarte a ti mismo el papel de superadministrador';
  end if;

  insert into evaluacion.profesores (user_id, nombre, rol, activo, centro_id)
  values (v_id, trim(p_nombre), p_rol, true, p_centro)
  on conflict (user_id) do update
    set nombre = excluded.nombre, rol = excluded.rol, activo = true, centro_id = excluded.centro_id;

  -- si cambia de centro, se le quitan los grupos del centro anterior
  delete from evaluacion.grupo_profesores gp
  using evaluacion.grupos g
  where gp.grupo_id = g.id and gp.user_id = v_id and g.centro_id is distinct from p_centro;
  return v_id;
end $$;

-- Poner una contraseña nueva a un profesor (por si la olvida)
create or replace function evaluacion.nueva_clave(p_user uuid, p_clave text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not evaluacion.es_superadmin() then
    raise exception 'Sólo el superadministrador puede cambiar contraseñas';
  end if;
  if not exists (select 1 from evaluacion.profesores where user_id = p_user) then
    raise exception 'Ese usuario no es profesor de la evaluación';
  end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;

revoke all on function evaluacion.lista_profesores() from public, anon;
revoke all on function evaluacion.alta_profesor(text, text, text, bigint, text) from public, anon;
revoke all on function evaluacion.nueva_clave(uuid, text) from public, anon;
grant execute on function evaluacion.lista_profesores() to authenticated;
grant execute on function evaluacion.alta_profesor(text, text, text, bigint, text) to authenticated;
grant execute on function evaluacion.nueva_clave(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. TÚ, SUPERADMINISTRADOR  ← CAMBIA ESTOS TRES DATOS
--    · Si tu cuenta ya existe (por ejemplo, la del Inventario), se usa
--      con su contraseña de siempre y la de aquí no se tiene en cuenta.
--    · Si no existe, se crea con esa contraseña (mínimo 8 caracteres).
-- ---------------------------------------------------------------------
do $$
declare
  v_correo text := 'TU_CORREO_PERSONAL@educa.madrid.org';   -- ← tu correo
  v_nombre text := 'Jose';                                   -- ← tu nombre
  v_clave  text := 'CambiaEstaClave2026';                    -- ← contraseña inicial
  v_id uuid;
begin
  if v_correo like 'TU_CORREO%' then
    raise exception 'Cambia el correo del superadministrador en la sección 7 antes de ejecutar el script';
  end if;
  select id into v_id from auth.users where lower(email) = lower(v_correo);
  if v_id is null then v_id := evaluacion._crear_cuenta(v_correo, v_clave, v_nombre); end if;
  insert into evaluacion.profesores (user_id, nombre, rol, activo, centro_id)
  values (v_id, v_nombre, 'superadmin', true, null)
  on conflict (user_id) do update set nombre = excluded.nombre, rol = 'superadmin', activo = true, centro_id = null;
  delete from evaluacion.grupo_profesores where user_id = v_id;
end $$;

-- centro ACE Pío Baroja (sin grupos por ahora; se crea con su lista de observaciones)
insert into evaluacion.centros (nombre) values ('ACE Pío Baroja');

-- admin@instituto.es: administrador sólo del centro ACE Pío Baroja
delete from evaluacion.grupo_profesores gp
using auth.users u where u.id = gp.user_id and lower(u.email) = 'admin@instituto.es';
update evaluacion.profesores p
set rol = 'admin', centro_id = (select id from evaluacion.centros where nombre = 'ACE Pío Baroja')
from auth.users u
where u.id = p.user_id and lower(u.email) = 'admin@instituto.es';

commit;

-- que la API vea ya las tablas y funciones nuevas
notify pgrst, 'reload schema';

-- Comprobación: tu cuenta como superadmin y admin@instituto.es como admin del Pío Baroja
select u.email, p.nombre, p.rol, c.nombre as centro, p.activo
from evaluacion.profesores p
join auth.users u on u.id = p.user_id
left join evaluacion.centros c on c.id = p.centro_id
order by p.rol desc, u.email;
