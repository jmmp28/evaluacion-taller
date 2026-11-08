-- =====================================================================
--  EVALUACIÓN DEL TALLER · esquema de base de datos para Supabase
--  Se instala en el MISMO proyecto que el Inventario, pero en su propio
--  esquema «evaluacion»: no toca ni lee ninguna tabla del inventario.
--
--  Cómo usarlo:
--    1. Supabase → SQL Editor → New query → pega TODO este archivo → Run.
--    2. Settings → Data API → «Exposed schemas»: añade  evaluacion  → Save.
--    3. Al final del archivo, cambia el correo del primer administrador
--       (sección 11) ANTES de ejecutarlo, o ejecuta esa parte después.
--
--  Para empezar de cero (BORRA todos los datos de la evaluación, nunca
--  los del inventario):  drop schema evaluacion cascade;  y vuelve a ejecutar.
-- =====================================================================

create schema if not exists evaluacion;

-- ---------------------------------------------------------------------
-- 1. PROFESORES Y GRUPOS
--    Tener cuenta en el inventario NO da acceso: hay que estar en
--    evaluacion.profesores (lo da un administrador).
-- ---------------------------------------------------------------------
create table evaluacion.profesores (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'profesor' check (rol in ('admin', 'profesor')),
  activo     boolean not null default true,
  creado     timestamptz not null default now()
);

create table evaluacion.grupos (
  id         bigint generated always as identity primary key,
  nombre     text not null,                       -- «2.º FPB Taller»
  curso      text not null,                       -- «2026-27»
  activo     boolean not null default true,
  creado     timestamptz not null default now(),
  unique (nombre, curso)
);

create table evaluacion.grupo_profesores (
  grupo_id   bigint not null references evaluacion.grupos (id) on delete cascade,
  user_id    uuid   not null references evaluacion.profesores (user_id) on delete cascade,
  primary key (grupo_id, user_id)
);

create table evaluacion.alumnos (
  id                bigint generated always as identity primary key,
  grupo_id          bigint not null references evaluacion.grupos (id) on delete cascade,
  apellidos_nombre  text   not null,              -- «Alonso García, Lucía»
  orden             integer,
  activo            boolean not null default true,
  unique (grupo_id, apellidos_nombre)
);

-- ---------------------------------------------------------------------
-- 2. ACTIVIDADES: CATEGORÍA · PROYECTO · TAREA (catálogo común del taller)
--    Un proyecto puede tener tareas de varias categorías
--    (PARED VIVIENDA: ALBAÑILERÍA y FONTANERÍA).
-- ---------------------------------------------------------------------
create table evaluacion.categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,                   -- «ALBAÑILERÍA»
  orden   integer not null default 0              -- su color sale de este orden
);

create table evaluacion.proyectos (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,                   -- «PARED VIVIENDA»
  activo  boolean not null default true           -- «en ejecución»
);

create table evaluacion.tareas (
  id            bigint generated always as identity primary key,
  categoria_id  bigint not null references evaluacion.categorias (id) on delete restrict,
  proyecto_id   bigint not null references evaluacion.proyectos (id) on delete restrict,
  nombre        text   not null,                  -- «demoler muro»
  unique (categoria_id, proyecto_id, nombre)
);

-- ---------------------------------------------------------------------
-- 3. OBSERVACIONES
-- ---------------------------------------------------------------------
create table evaluacion.observaciones (
  id     bigint generated always as identity primary key,
  texto  text not null unique,
  orden  integer not null default 0
);

-- observación que se pone sola al poner cada nota (editable)
create table evaluacion.observacion_por_nota (
  nota         text primary key check (nota in ('0', '1', '2', '3', 'A')),
  observacion  text
);

-- ---------------------------------------------------------------------
-- 4. SESIONES Y EVALUACIONES (lo que era la hoja «Registro»)
-- ---------------------------------------------------------------------
create table evaluacion.sesiones (
  id          bigint generated always as identity primary key,
  grupo_id    bigint   not null references evaluacion.grupos (id) on delete cascade,
  fecha       date     not null,
  numero      smallint not null check (numero between 1 and 3),
  tarea_id    bigint   references evaluacion.tareas (id) on delete set null,
  detalle     text,                               -- hora, material…
  creado_por  uuid     default auth.uid(),
  creado      timestamptz not null default now(),
  unique (grupo_id, fecha, numero)
);

create table evaluacion.evaluaciones (
  id           bigint generated always as identity primary key,
  sesion_id    bigint   not null references evaluacion.sesiones (id) on delete cascade,
  alumno_id    bigint   not null references evaluacion.alumnos (id) on delete cascade,
  nota         smallint check (nota between 0 and 3),
  ausente      boolean  not null default false,
  observacion  text,
  actualizado  timestamptz not null default now(),
  unique (sesion_id, alumno_id),
  -- un ausente no lleva nota (cuenta como 0 en los cálculos)
  check (not ausente or nota is null)
);

-- ---------------------------------------------------------------------
-- 5. PREVISIÓN MENSUAL
--    Categoría y tarea en blanco = vale cualquier trabajo del proyecto.
-- ---------------------------------------------------------------------
create table evaluacion.prevision (
  id                  bigint generated always as identity primary key,
  grupo_id            bigint not null references evaluacion.grupos (id) on delete cascade,
  mes                 date   not null check (extract(day from mes) = 1),   -- 1.er día del mes
  proyecto_id         bigint not null references evaluacion.proyectos (id) on delete cascade,
  categoria_id        bigint references evaluacion.categorias (id) on delete cascade,
  tarea_id            bigint references evaluacion.tareas (id) on delete cascade,
  sesiones_previstas  smallint check (sesiones_previstas > 0),
  notas               text
);

-- ---------------------------------------------------------------------
-- 6. FOTOS (la imagen va al bucket privado «evaluacion-fotos»,
--    en la carpeta del grupo:  <grupo_id>/<nombre>.jpg)
-- ---------------------------------------------------------------------
create table evaluacion.fotos (
  id           bigint generated always as identity primary key,
  grupo_id     bigint not null references evaluacion.grupos (id) on delete cascade,
  proyecto_id  bigint not null references evaluacion.proyectos (id) on delete cascade,
  fecha        date   not null default current_date,
  descripcion  text,
  ruta         text   not null unique,            -- ruta dentro del bucket
  ancho        integer,
  alto         integer,
  subida_por   uuid   default auth.uid(),
  creado       timestamptz not null default now(),
  check (ruta like grupo_id::text || '/%')
);

-- Índices para los informes
create index on evaluacion.sesiones (grupo_id, fecha);
create index on evaluacion.evaluaciones (alumno_id);
create index on evaluacion.alumnos (grupo_id);
create index on evaluacion.fotos (grupo_id, proyecto_id, fecha);
create index on evaluacion.prevision (grupo_id, mes);
create index on evaluacion.tareas (proyecto_id);

-- fecha de la última modificación de cada evaluación
create or replace function evaluacion.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

create trigger evaluaciones_actualizado
  before update on evaluacion.evaluaciones
  for each row execute function evaluacion.tocar_actualizado();

-- ---------------------------------------------------------------------
-- 7. PERMISOS (RLS): todo cerrado salvo lo que se abre aquí
-- ---------------------------------------------------------------------
create or replace function evaluacion.es_profesor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo);
$$;

create or replace function evaluacion.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from evaluacion.profesores p
                 where p.user_id = auth.uid() and p.activo and p.rol = 'admin');
$$;

-- ¿puede el usuario actual trabajar con este grupo?
create or replace function evaluacion.puede_grupo(g bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select evaluacion.es_admin()
      or exists (select 1
                 from evaluacion.grupo_profesores gp
                 join evaluacion.profesores p on p.user_id = gp.user_id
                 where gp.grupo_id = g and gp.user_id = auth.uid() and p.activo);
$$;

create or replace function evaluacion.puede_sesion(s bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select evaluacion.puede_grupo((select se.grupo_id from evaluacion.sesiones se where se.id = s));
$$;

-- el alumno evaluado tiene que ser del mismo grupo que la sesión
create or replace function evaluacion.alumno_de_sesion(a bigint, s bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1
                 from evaluacion.alumnos al
                 join evaluacion.sesiones se on se.grupo_id = al.grupo_id
                 where al.id = a and se.id = s);
$$;

alter table evaluacion.profesores           enable row level security;
alter table evaluacion.grupos               enable row level security;
alter table evaluacion.grupo_profesores     enable row level security;
alter table evaluacion.alumnos              enable row level security;
alter table evaluacion.categorias           enable row level security;
alter table evaluacion.proyectos            enable row level security;
alter table evaluacion.tareas               enable row level security;
alter table evaluacion.observaciones        enable row level security;
alter table evaluacion.observacion_por_nota enable row level security;
alter table evaluacion.sesiones             enable row level security;
alter table evaluacion.evaluaciones         enable row level security;
alter table evaluacion.prevision            enable row level security;
alter table evaluacion.fotos                enable row level security;

-- profesores: cada uno se ve a sí mismo; el admin los gestiona
create policy "ver profesores" on evaluacion.profesores for select to authenticated
  using (user_id = auth.uid() or evaluacion.es_admin());
create policy "admin gestiona profesores" on evaluacion.profesores for all to authenticated
  using (evaluacion.es_admin()) with check (evaluacion.es_admin());

-- grupos: se ven los propios; los crea el admin
create policy "ver grupos" on evaluacion.grupos for select to authenticated
  using (evaluacion.puede_grupo(id));
create policy "admin gestiona grupos" on evaluacion.grupos for all to authenticated
  using (evaluacion.es_admin()) with check (evaluacion.es_admin());

create policy "ver asignaciones" on evaluacion.grupo_profesores for select to authenticated
  using (user_id = auth.uid() or evaluacion.es_admin());
create policy "admin asigna grupos" on evaluacion.grupo_profesores for all to authenticated
  using (evaluacion.es_admin()) with check (evaluacion.es_admin());

-- alumnos, sesiones, previsión y fotos: los del grupo propio
create policy "alumnos del grupo" on evaluacion.alumnos for all to authenticated
  using (evaluacion.puede_grupo(grupo_id)) with check (evaluacion.puede_grupo(grupo_id));
create policy "sesiones del grupo" on evaluacion.sesiones for all to authenticated
  using (evaluacion.puede_grupo(grupo_id)) with check (evaluacion.puede_grupo(grupo_id));
create policy "prevision del grupo" on evaluacion.prevision for all to authenticated
  using (evaluacion.puede_grupo(grupo_id)) with check (evaluacion.puede_grupo(grupo_id));
create policy "fotos del grupo" on evaluacion.fotos for all to authenticated
  using (evaluacion.puede_grupo(grupo_id)) with check (evaluacion.puede_grupo(grupo_id));

create policy "evaluaciones del grupo" on evaluacion.evaluaciones for all to authenticated
  using (evaluacion.puede_sesion(sesion_id))
  with check (evaluacion.puede_sesion(sesion_id) and evaluacion.alumno_de_sesion(alumno_id, sesion_id));

-- catálogo común: cualquier profesor lo ve y añade (actividades nuevas
-- desde el móvil); sólo el admin borra
do $$
declare t text;
begin
  foreach t in array array['categorias', 'proyectos', 'tareas', 'observaciones', 'observacion_por_nota'] loop
    execute format('create policy "ver %1$s" on evaluacion.%1$I for select to authenticated using (evaluacion.es_profesor())', t);
    execute format('create policy "añadir %1$s" on evaluacion.%1$I for insert to authenticated with check (evaluacion.es_profesor())', t);
    execute format('create policy "cambiar %1$s" on evaluacion.%1$I for update to authenticated using (evaluacion.es_profesor()) with check (evaluacion.es_profesor())', t);
    execute format('create policy "borrar %1$s" on evaluacion.%1$I for delete to authenticated using (evaluacion.es_admin())', t);
  end loop;
end $$;

-- acceso por la API sólo para usuarios con sesión iniciada (nunca anónimos)
grant usage on schema evaluacion to authenticated, service_role;
grant select, insert, update, delete on all tables in schema evaluacion to authenticated, service_role;
grant usage, select on all sequences in schema evaluacion to authenticated, service_role;
grant execute on all functions in schema evaluacion to authenticated, service_role;
revoke all on schema evaluacion from anon;
alter default privileges in schema evaluacion grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema evaluacion grant usage, select on sequences to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. VISTA «REGISTRO» (como la hoja de Calc: para informes y exportar)
--    security_invoker: respeta los permisos de quien la consulta.
-- ---------------------------------------------------------------------
create view evaluacion.registro with (security_invoker = true) as
select
  se.fecha,
  g.id                 as grupo_id,
  g.nombre             as grupo,
  al.id                as alumno_id,
  al.apellidos_nombre  as alumno,
  se.numero            as sesion,
  c.nombre             as categoria,
  p.nombre             as proyecto,
  t.nombre             as tarea,
  se.detalle,
  case when ev.ausente then 0 else ev.nota end as nota,   -- ausente cuenta 0
  case when ev.ausente then 'Ausente'
       when ev.nota is not null then 'Presente' end as asistencia,
  ev.observacion
from evaluacion.evaluaciones ev
join evaluacion.sesiones se   on se.id = ev.sesion_id
join evaluacion.grupos g      on g.id = se.grupo_id
join evaluacion.alumnos al    on al.id = ev.alumno_id
left join evaluacion.tareas t      on t.id = se.tarea_id
left join evaluacion.categorias c  on c.id = t.categoria_id
left join evaluacion.proyectos p   on p.id = t.proyecto_id;

grant select on evaluacion.registro to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. BUCKET PRIVADO PARA LAS FOTOS
--    Ruta de cada foto: <grupo_id>/<nombre>.jpg  (sólo ese grupo la ve)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evaluacion-fotos', 'evaluacion-fotos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function evaluacion.grupo_de_ruta(ruta text)
returns bigint language sql immutable set search_path = '' as $$
  select case when split_part(ruta, '/', 1) ~ '^[0-9]+$'
              then split_part(ruta, '/', 1)::bigint end;
$$;

drop policy if exists "evaluacion fotos ver"    on storage.objects;
drop policy if exists "evaluacion fotos subir"  on storage.objects;
drop policy if exists "evaluacion fotos cambiar" on storage.objects;
drop policy if exists "evaluacion fotos borrar" on storage.objects;

create policy "evaluacion fotos ver" on storage.objects for select to authenticated
  using (bucket_id = 'evaluacion-fotos' and evaluacion.puede_grupo(evaluacion.grupo_de_ruta(name)));
create policy "evaluacion fotos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'evaluacion-fotos' and evaluacion.puede_grupo(evaluacion.grupo_de_ruta(name)));
create policy "evaluacion fotos cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'evaluacion-fotos' and evaluacion.puede_grupo(evaluacion.grupo_de_ruta(name)));
create policy "evaluacion fotos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'evaluacion-fotos' and evaluacion.puede_grupo(evaluacion.grupo_de_ruta(name)));

-- ---------------------------------------------------------------------
-- 10. DATOS INICIALES
-- ---------------------------------------------------------------------
insert into evaluacion.observaciones (texto, orden) values
  ('Trabaja bien', 1), ('Trabajo correcto', 2), ('Participa activamente', 3),
  ('Muy buena actitud', 4), ('Ha mejorado', 5), ('Le cuesta, necesita apoyo', 6),
  ('No trabaja', 7), ('No trae el material', 8), ('No ha hecho la tarea', 9),
  ('Se distrae', 10), ('Habla / interrumpe', 11), ('Llega tarde', 12),
  ('Uso indebido del móvil', 13), ('Ausencia justificada', 14),
  ('Ausencia sin justificar', 15), ('Expulsado del aula', 16);

insert into evaluacion.observacion_por_nota (nota, observacion) values
  ('3', 'Trabaja bien'), ('2', 'Trabajo correcto'),
  ('1', 'Le cuesta, necesita apoyo'), ('0', 'No trabaja'), ('A', null);

-- ---------------------------------------------------------------------
-- 11. PRIMER ADMINISTRADOR
--     Cambia el correo por el de TU cuenta del inventario (la que usas
--     para entrar en piobaroja.eu). Tiene que existir ya en Authentication.
-- ---------------------------------------------------------------------
insert into evaluacion.profesores (user_id, nombre, rol)
select id, 'Jose', 'admin'
from auth.users
where email = 'TU_CORREO@educa.madrid.org'
on conflict (user_id) do update set rol = 'admin', activo = true;
