# Evaluación del taller · web (fases 1, 2 y 3)

App web para evaluar a diario desde el móvil. Usa el **mismo proyecto de Supabase que el Inventario** (esquema `evaluacion`) y el mismo inicio de sesión.

**Fase 1 (esta):** entrar · Hoy (cualquier fecha) · evaluar sesiones con notas 0–3/A que se guardan al momento · observaciones automáticas y a mano · actividad Categoría → Proyecto → Tarea (y crear nuevas) · alumnos · exportar CSV · administración de grupos y profesores.
**Fase 2:** fotos de los proyectos desde el móvil (cámara o galería), por mes y proyecto, también desde cada sesión.
**Fase 3:** informes (resumen, por alumno con comentario, trabajos del grupo frente a la previsión, proyectos en A4) y previsión mensual.
**Próximas fases:** importar el registro de la hoja de Calc.

---

## 1. Supabase (una sola vez)

1. Ya hecho: `sql/01_evaluacion_esquema.sql` y el esquema `evaluacion` en *Exposed schemas*.
2. **SQL Editor → New query →** pega `sql/02_funciones_admin.sql` **→ Run.** (Permite dar de alta profesores por su correo desde la web.)
3. **Authentication → URL Configuration → Redirect URLs → Add URL:** `https://taller.piobaroja.eu/**`
   (sólo para los correos de «He olvidado la contraseña»). **No cambies la *Site URL*:** es la del Inventario.

## 2. Probarla en tu ordenador (opcional)

Necesitas Node 18 o superior.

```bash
npm install
cp .env.example .env      # y pon dentro la URL y la clave anon del Inventario
npm run dev               # abre http://localhost:5173
```

La URL y la clave están en Supabase → **Settings → API** (*Project URL* y *anon public*). Son las mismas que usa el Inventario.

## 3. Publicarla (GitHub + Vercel, como el Inventario)

1. Crea un repositorio nuevo en la cuenta de GitHub del Inventario (por ejemplo `evaluacion-taller`) y sube esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Evaluación del taller: fase 1"
   git branch -M main
   git remote add origin https://github.com/TU-CUENTA/evaluacion-taller.git
   git push -u origin main
   ```
2. Vercel → **Add New → Project** → importa el repositorio. Detecta Vite solo.
3. En **Environment Variables** añade:
   - `VITE_SUPABASE_URL` = la *Project URL*
   - `VITE_SUPABASE_ANON_KEY` = la clave *anon public*
4. **Deploy.**

## 4. El subdominio `taller.piobaroja.eu`

1. Vercel → el proyecto → **Settings → Domains → Add** → `taller.piobaroja.eu`.
2. Strato → DNS de `piobaroja.eu` → nuevo registro **CNAME**: nombre `taller`, valor el que te indique Vercel (normalmente `cname.vercel-dns.com`).
3. Espera a que Vercel lo marque como válido (de minutos a unas horas).

## 5. Primer uso

1. Entra con tu cuenta del Inventario (la que pusiste de administrador en el script 01).
2. Te pedirá **crear el primer grupo** (por ejemplo «2.º FPB Taller», curso «2026-27»).
3. **Alumnos:** pega la lista, uno por línea, «Apellidos, Nombre».
4. **Ajustes → Profesores:** da de alta a otros profesores por su correo y márcales sus grupos. Necesitan tener cuenta: la del Inventario sirve. Si no la tienen, créala en Supabase → Authentication → Users.
5. **Hoy → Empezar sesión → Elegir actividad** → y a evaluar.

## 6. Instalarla en el móvil

- **Android (Chrome):** menú ⋮ → *Añadir a pantalla de inicio*.
- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

Se abre a pantalla completa, como una app.

## Cosas que conviene saber

- Las notas **se guardan al tocar**. Tocar otra vez la misma nota la quita.
- La observación se pone sola según la nota (tabla `evaluacion.observacion_por_nota`). Si la cambias a mano, se respeta aunque cambies la nota.
- Al empezar una sesión, propone la actividad de la última sesión con ese número.
- **Dar de baja** a un alumno no borra sus notas. Borrar una sesión sí borra sus notas (lo pregunta antes).
- Un profesor sólo ve sus grupos. Una cuenta que sólo usa el Inventario no ve nada de la evaluación.
- Para cambiar los colores (por ejemplo, al verde y gris del Inventario) basta con tocar las primeras líneas de `src/estilos.css`.

## Fotos (fase 2)

- No necesita ningún SQL nuevo: el bucket privado `evaluacion-fotos` lo creó el script 01. Compruébalo en Supabase → **Storage**.
- Se hacen desde **Fotos** (por mes, un bloque por proyecto trabajado ese mes, y «Fotos de otro proyecto») o desde la propia **sesión** (van al proyecto y la fecha de la sesión).
- El móvil las reduce antes de subirlas: 1600 px (unos 300 KB) y una miniatura de 400 px. Salen derechas aunque el móvil las guarde giradas.
- Tocando una foto: verla en grande, cambiar la fecha, ponerle pie, **Girar** y **Borrar**.
- Sólo las ven los profesores del grupo. El plan gratuito de Supabase da 1 GB de almacenamiento: unas 3000 fotos, compartido con el Inventario.

## Informes (fase 3)

Pestaña **Informes**. No necesita SQL nuevo (la tabla `prevision` ya la creó el script 01).

- **Resumen de notas:** por alumno, sesiones, ausencias, % de asistencia, media (0–3) y nota /10 del periodo elegido; debajo, la tabla por trimestres (1T oct–dic, 2T ene–mar, 3T abr–jun), curso y meses, eligiendo qué dato ver.
- **Informe por alumno:** uno o todos; sus trabajos por Proyecto → Categoría → Tarea con sesiones, faltas, media y nota, y un comentario redactado solo (se puede retocar antes de imprimir). Cada alumno, en una página.
- **Trabajos del grupo:** lo hecho en el periodo, sin notas, frente a la previsión (Realizada · Parcial · Pendiente · No prevista), con las fotos de cada proyecto.
- **Proyectos en A4:** una página por proyecto con el título, las categorías y tareas y las fotos repartidas según cuántas sean (más de 12, sigue en otra página).
- **Previsión:** para cada mes, proyecto (y si quieres categoría, tarea y sesiones previstas). «Copiar la previsión del mes anterior» la rellena de golpe.
- **Imprimir / PDF:** usa la impresión del navegador. En el ordenador, «Guardar como PDF». En Chrome conviene dejar márgenes «Predeterminados» y marcar «Gráficos de fondo» para que salgan los colores.

## Estructura

```
sql/01_evaluacion_esquema.sql   tablas, permisos (RLS), bucket de fotos
sql/02_funciones_admin.sql      alta de profesores por correo
src/supabase.js                 conexión (esquema «evaluacion»)
src/contexto.jsx                sesión, profesor y grupo actual
src/paginas/                    Login, Hoy, Sesion, Alumnos, Ajustes…
src/fotos.js                    reducir, subir, girar y borrar fotos
src/informes/                   periodos, cálculos y comentario automático de los informes
src/componentes/                barra inferior, selector de actividad, panel inferior, visor de fotos
src/estilos.css                 todos los estilos y colores
```
