-- =====================================================================
--  EVALUACIÓN DEL TALLER · corrección de centros (4.º script)
--  SÓLO si ya ejecutaste la versión ANTERIOR del script 03 (la que
--  dejaba todo en «ACE Pío Baroja»). Si aún no habías ejecutado el 03,
--  no uses este: ejecuta el 03 nuevo y listo.
--
--  Qué hace:
--   · El centro donde está tu taller pasa a llamarse «ACE Vista Alegre».
--   · Crea «ACE Pío Baroja» vacío (con su lista de observaciones).
--   · admin@instituto.es pasa a ser admin del Pío Baroja.
--  Si algo falla, no se cambia nada.
-- =====================================================================

begin;

do $$
begin
  if exists (select 1 from evaluacion.centros where nombre = 'ACE Vista Alegre') then
    raise exception 'Ya existe un centro «ACE Vista Alegre»: no hace falta este script (o avísame antes de seguir)';
  end if;
  if not exists (select 1 from evaluacion.centros where nombre = 'ACE Pío Baroja') then
    raise exception 'No encuentro el centro «ACE Pío Baroja»: ¿ejecutaste el script 03 anterior?';
  end if;
end $$;

-- el centro con tus grupos y actividades es el de Vista Alegre
update evaluacion.centros set nombre = 'ACE Vista Alegre' where nombre = 'ACE Pío Baroja';

-- Pío Baroja, nuevo y vacío
insert into evaluacion.centros (nombre) values ('ACE Pío Baroja');

-- admin@instituto.es: administrador sólo del Pío Baroja
delete from evaluacion.grupo_profesores gp
using auth.users u where u.id = gp.user_id and lower(u.email) = 'admin@instituto.es';
update evaluacion.profesores p
set rol = 'admin', centro_id = (select id from evaluacion.centros where nombre = 'ACE Pío Baroja')
from auth.users u
where u.id = p.user_id and lower(u.email) = 'admin@instituto.es';

commit;

select u.email, p.nombre, p.rol, c.nombre as centro, p.activo
from evaluacion.profesores p
join auth.users u on u.id = p.user_id
left join evaluacion.centros c on c.id = p.centro_id
order by p.rol desc, u.email;
