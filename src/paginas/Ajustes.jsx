import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { fechaCorta, hoyISO, mensajeError } from '../util'

function cursoActual() {
  const d = new Date()
  const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${a}-${String((a + 1) % 100).padStart(2, '0')}`
}

const celdaCSV = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const PAPEL = { superadmin: 'Superadministrador', admin: 'Administrador del centro', profesor: 'Profesor' }

// «Centro · Grupo · curso» si hay grupos de varios centros
export function nombreGrupo(g, grupos) {
  const variosCentros = new Set(grupos.map((x) => x.centro_id)).size > 1
  return `${variosCentros && g.centro?.nombre ? g.centro.nombre + ' · ' : ''}${g.nombre} · ${g.curso}`
}

export default function Ajustes({ sinGrupos }) {
  const { sesion, profesor, esAdmin, esSuper, grupos, grupo, setGrupoId, cargarGrupos, salir } = useApp()
  const [exp, setExp] = useState({ desde: '', hasta: '', ocupado: false, msg: '' })

  async function exportar() {
    setExp((e) => ({ ...e, ocupado: true, msg: '' }))
    const filas = []
    for (let desde = 0; ; desde += 1000) {
      let q = supabase.from('registro')
        .select('fecha, alumno, sesion, categoria, proyecto, tarea, detalle, nota, asistencia, observacion')
        .eq('grupo_id', grupo.id).order('fecha').order('sesion').order('alumno').range(desde, desde + 999)
      if (exp.desde) q = q.gte('fecha', exp.desde)
      if (exp.hasta) q = q.lte('fecha', exp.hasta)
      const { data, error } = await q
      if (error) { setExp((e) => ({ ...e, ocupado: false, msg: mensajeError(error) })); return }
      filas.push(...data)
      if (data.length < 1000) break
    }
    const cab = ['Fecha', 'Alumno', 'Sesión', 'Categoría', 'Proyecto', 'Tarea', 'Detalle', 'Nota', 'Asistencia', 'Observación']
    const lineas = [cab.join(';'), ...filas.map((f) => [fechaCorta(f.fecha), f.alumno, f.sesion, f.categoria, f.proyecto,
      f.tarea, f.detalle, f.nota, f.asistencia, f.observacion].map(celdaCSV).join(';'))]
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `registro_${grupo.nombre.replace(/[^\p{L}\p{N}]+/gu, '_')}_${hoyISO()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setExp((e) => ({ ...e, ocupado: false, msg: `Exportadas ${filas.length} filas.` }))
  }

  return (
    <>
      <header className="cabecera">
        <h1 className="titulo">Ajustes</h1>
        <p className="suave">{profesor.nombre} · {sesion.user.email}</p>
        <p className="suave pequeno">{PAPEL[profesor.rol]}{profesor.centro?.nombre ? ` · ${profesor.centro.nombre}` : ''}</p>
      </header>
      <main className="pila">
        {sinGrupos && <p className="aviso">Aún no hay ningún grupo. Créalo abajo, en Administración → Grupos.</p>}

        {grupos.length > 1 && (
          <section className="tarjeta pila">
            <h2 className="subtitulo">Grupo</h2>
            <label className="campo">
              <span>Grupo con el que trabajas</span>
              <select value={grupo?.id ?? ''} onChange={(e) => setGrupoId(Number(e.target.value))}>
                {grupos.map((g) => <option key={g.id} value={g.id}>{nombreGrupo(g, grupos)}</option>)}
              </select>
            </label>
          </section>
        )}

        {grupo && (
          <section className="tarjeta pila">
            <h2 className="subtitulo">Copia del registro</h2>
            <p className="suave pequeno">Descarga las notas de {grupo.nombre} en CSV (se abre con LibreOffice o Excel). Deja las fechas en blanco para todo.</p>
            <div className="dos-columnas">
              <label className="campo"><span>Desde</span><input type="date" value={exp.desde} onChange={(e) => setExp({ ...exp, desde: e.target.value })} /></label>
              <label className="campo"><span>Hasta</span><input type="date" value={exp.hasta} onChange={(e) => setExp({ ...exp, hasta: e.target.value })} /></label>
            </div>
            <button className="boton" onClick={exportar} disabled={exp.ocupado}>{exp.ocupado ? 'Preparando…' : 'Exportar CSV'}</button>
            {exp.msg && <p className="aviso" role="status">{exp.msg}</p>}
          </section>
        )}

        {esAdmin && grupo && (
          <section className="tarjeta pila">
            <h2 className="subtitulo">Datos de la hoja de Calc</h2>
            <p className="suave pequeno">Pasa a la web los alumnos, actividades, notas, previsión y fotos de un archivo Evaluacion_diaria.ods.</p>
            <Link className="boton" to="/importar">Importar de la hoja de Calc</Link>
          </section>
        )}

        <MiClave />

        {esSuper && <Administracion cargarGrupos={cargarGrupos} miId={sesion.user.id} />}

        <button className="boton" onClick={salir}>Cerrar sesión</button>
      </main>
    </>
  )
}

// ---------------------------------------------------------------- todos: cambiar la propia contraseña
function MiClave() {
  const [abierta, setAbierta] = useState(false)
  const [c, setC] = useState({ una: '', otra: '' })
  const [msg, setMsg] = useState({ error: '', aviso: '' })

  async function guardar(e) {
    e.preventDefault()
    if (c.una.length < 8) { setMsg({ error: 'Tiene que tener al menos 8 caracteres.', aviso: '' }); return }
    if (c.una !== c.otra) { setMsg({ error: 'Las dos contraseñas no coinciden.', aviso: '' }); return }
    const { error } = await supabase.auth.updateUser({ password: c.una })
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    setC({ una: '', otra: '' }); setAbierta(false)
    setMsg({ error: '', aviso: 'Contraseña cambiada.' })
  }

  return (
    <section className="tarjeta pila">
      <h2 className="subtitulo">Mi contraseña</h2>
      {msg.aviso && <p className="aviso" role="status">{msg.aviso}</p>}
      {!abierta ? (
        <button className="boton" onClick={() => { setAbierta(true); setMsg({ error: '', aviso: '' }) }}>Cambiar mi contraseña</button>
      ) : (
        <form className="pila" onSubmit={guardar}>
          {msg.error && <p className="error" role="alert">{msg.error}</p>}
          <label className="campo"><span>Contraseña nueva</span>
            <input type="password" autoComplete="new-password" value={c.una} onChange={(e) => setC({ ...c, una: e.target.value })} />
          </label>
          <label className="campo"><span>Repítela</span>
            <input type="password" autoComplete="new-password" value={c.otra} onChange={(e) => setC({ ...c, otra: e.target.value })} />
          </label>
          <div className="acciones">
            <button className="boton primario">Guardar</button>
            <button type="button" className="boton" onClick={() => { setAbierta(false); setMsg({ error: '', aviso: '' }) }}>Cancelar</button>
          </div>
          <p className="suave pequeno">Es la misma cuenta que la del Inventario: si también entras allí, la contraseña nueva vale para los dos.</p>
        </form>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- sólo el superadministrador
const PROFE_VACIO = { email: '', nombre: '', rol: 'profesor', centro: '', clave: '' }

function Administracion({ cargarGrupos, miId }) {
  const [centros, setCentros] = useState([])
  const [grupos, setGrupos] = useState([])
  const [profes, setProfes] = useState([])
  const [asign, setAsign] = useState([])               // { grupo_id, user_id }
  const [filtro, setFiltro] = useState('')             // centro_id que se muestra ('' = todos)
  const [nuevoCentro, setNuevoCentro] = useState('')
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', curso: cursoActual(), centro: '' })
  const [profe, setProfe] = useState(PROFE_VACIO)
  const [editando, setEditando] = useState(false)
  const [msg, setMsg] = useState({ error: '', aviso: '' })

  const cargar = useCallback(async () => {
    const [c, g, p, a] = await Promise.all([
      supabase.from('centros').select('id, nombre, activo').order('nombre'),
      supabase.from('grupos').select('id, nombre, curso, activo, centro_id').order('curso', { ascending: false }).order('nombre'),
      supabase.rpc('lista_profesores'),
      supabase.from('grupo_profesores').select('grupo_id, user_id'),
    ])
    const err = c.error || g.error || p.error || a.error
    if (err) setMsg({ error: mensajeError(err), aviso: '' })
    setCentros(c.data ?? []); setGrupos(g.data ?? []); setProfes(p.data ?? []); setAsign(a.data ?? [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const hecho = async (error, aviso) => {
    setMsg(error ? { error: mensajeError(error), aviso: '' } : { error: '', aviso })
    await cargar(); await cargarGrupos()
  }

  const nombreCentro = (id) => centros.find((c) => c.id === id)?.nombre ?? ''
  const centrosVistos = filtro ? centros.filter((c) => c.id === Number(filtro)) : centros

  // ---- centros
  async function crearCentro(e) {
    e.preventDefault()
    const nombre = nuevoCentro.trim()
    if (!nombre) return
    const { error } = await supabase.from('centros').insert({ nombre })
    if (!error) setNuevoCentro('')
    await hecho(error, `Centro «${nombre}» creado. Ahora crea sus grupos y da de alta a sus profesores.`)
  }

  async function renombrarCentro(c) {
    const nombre = window.prompt('Nuevo nombre del centro', c.nombre)?.trim()
    if (!nombre || nombre === c.nombre) return
    const { error } = await supabase.from('centros').update({ nombre }).eq('id', c.id)
    await hecho(error, 'Centro renombrado.')
  }

  // ---- grupos
  async function crearGrupo(e) {
    e.preventDefault()
    const centro = Number(nuevoGrupo.centro || filtro || (centros.length === 1 ? centros[0].id : 0))
    if (!centro) { setMsg({ error: 'Elige el centro del grupo.', aviso: '' }); return }
    if (!nuevoGrupo.nombre.trim()) return
    const { error } = await supabase.from('grupos')
      .insert({ nombre: nuevoGrupo.nombre.trim(), curso: nuevoGrupo.curso.trim(), centro_id: centro })
    if (!error) setNuevoGrupo({ nombre: '', curso: cursoActual(), centro: nuevoGrupo.centro })
    await hecho(error, 'Grupo creado.')
  }

  // ---- profesores
  async function guardarProfe(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('alta_profesor', {
      p_email: profe.email.trim(), p_nombre: profe.nombre.trim(), p_rol: profe.rol,
      p_centro: profe.rol === 'superadmin' ? null : Number(profe.centro) || null,
      p_clave: profe.clave || null,
    })
    if (!error) { setProfe({ ...PROFE_VACIO, centro: profe.centro }); setEditando(false) }
    await hecho(error, editando ? 'Cambios guardados.' : 'Profesor dado de alta. Si es profesor, márcale sus grupos.')
  }

  function editar(p) {
    setEditando(true)
    setProfe({ email: p.email, nombre: p.nombre, rol: p.rol, centro: p.centro_id ? String(p.centro_id) : '', clave: '' })
    setMsg({ error: '', aviso: '' })
    document.getElementById('form-profe')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function nuevaClave(p) {
    const clave = window.prompt(`Contraseña nueva para ${p.nombre} (${p.email}), mínimo 8 caracteres.\nOjo: es la misma cuenta del Inventario.`)
    if (!clave) return
    const { error } = await supabase.rpc('nueva_clave', { p_user: p.user_id, p_clave: clave })
    await hecho(error, `Contraseña de ${p.nombre} cambiada. Díselo para que entre y la cambie en Ajustes.`)
  }

  async function asignar(userId, grupoId, si) {
    // se marca al momento; si falla, se recarga y vuelve a su estado real
    setAsign((l) => si ? [...l, { grupo_id: grupoId, user_id: userId }]
      : l.filter((x) => !(x.grupo_id === grupoId && x.user_id === userId)))
    const { error } = si
      ? await supabase.from('grupo_profesores').insert({ grupo_id: grupoId, user_id: userId })
      : await supabase.from('grupo_profesores').delete().eq('grupo_id', grupoId).eq('user_id', userId)
    await hecho(error, '')
  }

  const profesVistos = profes.filter((p) => !filtro || p.centro_id === Number(filtro) || p.rol === 'superadmin')

  return (
    <section className="tarjeta pila" aria-label="Administración">
      <h2 className="subtitulo">Administración</h2>
      {msg.error && <p className="error" role="alert">{msg.error}</p>}
      {msg.aviso && <p className="aviso" role="status">{msg.aviso}</p>}

      {centros.length > 1 && (
        <label className="campo">
          <span>Ver</span>
          <select aria-label="Ver" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos los centros</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}

      {/* ---------------- centros */}
      <h3 className="paso">Centros</h3>
      <ul className="lista-simple">
        {centros.map((c) => (
          <li key={c.id} className="fila-alumno">
            <span>
              <strong>{c.nombre}</strong>{' '}
              <span className="suave pequeno">
                {grupos.filter((g) => g.centro_id === c.id && g.activo).length} grupos ·{' '}
                {profes.filter((p) => p.centro_id === c.id && p.activo).length} profesores
              </span>
            </span>
            <button className="boton pequeno" onClick={() => renombrarCentro(c)}>Renombrar</button>
          </li>
        ))}
      </ul>
      <form className="fila-nuevo" onSubmit={crearCentro}>
        <label className="sr" htmlFor="nuevo-centro">Nuevo centro</label>
        <input id="nuevo-centro" value={nuevoCentro} placeholder="Nombre del centro nuevo" onChange={(e) => setNuevoCentro(e.target.value)} />
        <button className="boton primario pequeno">Crear centro</button>
      </form>

      {/* ---------------- grupos */}
      <h3 className="paso">Grupos</h3>
      {centrosVistos.map((c) => {
        const gs = grupos.filter((g) => g.centro_id === c.id)
        return (
          <div key={c.id} className="pila sin-relleno apretada">
            {centros.length > 1 && <p className="suave pequeno"><strong>{c.nombre}</strong></p>}
            <ul className="lista-simple">
              {gs.map((g) => (
                <li key={g.id} className="fila-alumno">
                  <span>{g.nombre} · {g.curso}{!g.activo && <span className="suave"> (archivado)</span>}</span>
                  <button className="boton pequeno" onClick={async () => {
                    const { error } = await supabase.from('grupos').update({ activo: !g.activo }).eq('id', g.id)
                    await hecho(error, '')
                  }}>{g.activo ? 'Archivar' : 'Recuperar'}</button>
                </li>
              ))}
              {gs.length === 0 && <li className="suave pequeno">Sin grupos todavía.</li>}
            </ul>
          </div>
        )
      })}
      <form className="pila sin-relleno" onSubmit={crearGrupo} aria-label="Nuevo grupo">
        {centros.length > 1 && (
          <label className="campo"><span>Centro del grupo nuevo</span>
            <select aria-label="Centro del grupo nuevo" value={nuevoGrupo.centro || filtro} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, centro: e.target.value })}>
              <option value="">Elige…</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        <div className="dos-columnas">
          <label className="campo"><span>Nuevo grupo</span><input value={nuevoGrupo.nombre} placeholder="2.º FPB Taller" onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value })} /></label>
          <label className="campo"><span>Curso</span><input value={nuevoGrupo.curso} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, curso: e.target.value })} /></label>
        </div>
        <button className="boton primario">Crear grupo</button>
      </form>

      {/* ---------------- profesores */}
      <h3 className="paso">Profesores</h3>
      <ul className="lista-simple">
        {profesVistos.map((p) => (
          <li key={p.user_id} className="tarjeta pila profe" aria-label={p.nombre}>
            <div className="fila-alumno">
              <span className="pila sin-relleno apretada">
                <strong>{p.nombre}{!p.activo && <span className="suave"> · sin acceso</span>}</strong>
                <span className="suave pequeno">{p.email}</span>
                <span className="suave pequeno">{PAPEL[p.rol]}{p.centro_id ? ` · ${nombreCentro(p.centro_id)}` : ''}</span>
              </span>
            </div>
            <div className="acciones">
              <button className="boton pequeno" onClick={() => editar(p)}>Editar</button>
              <button className="boton pequeno" onClick={() => nuevaClave(p)}>Contraseña nueva</button>
              {p.user_id !== miId && (
                <button className="boton pequeno" onClick={async () => {
                  const { error } = await supabase.from('profesores').update({ activo: !p.activo }).eq('user_id', p.user_id)
                  await hecho(error, '')
                }}>{p.activo ? 'Quitar acceso' : 'Dar acceso'}</button>
              )}
            </div>
            {p.rol === 'profesor' && (
              <fieldset className="checks">
                <legend className="suave pequeno">Sus grupos</legend>
                {grupos.filter((g) => g.activo && g.centro_id === p.centro_id).map((g) => {
                  const si = asign.some((x) => x.user_id === p.user_id && x.grupo_id === g.id)
                  return (
                    <label key={g.id} className="check">
                      <input type="checkbox" checked={si} onChange={() => asignar(p.user_id, g.id, !si)} />
                      {g.nombre}
                    </label>
                  )
                })}
                {!grupos.some((g) => g.activo && g.centro_id === p.centro_id) && <span className="suave pequeno">Su centro aún no tiene grupos.</span>}
              </fieldset>
            )}
            {p.rol === 'admin' && <p className="suave pequeno">Ve todos los grupos de {nombreCentro(p.centro_id)}.</p>}
            {p.rol === 'superadmin' && <p className="suave pequeno">Ve y gestiona todos los centros.</p>}
          </li>
        ))}
      </ul>

      <form id="form-profe" className="tarjeta pila" onSubmit={guardarProfe} aria-label={editando ? 'Editar profesor' : 'Alta de profesor'}>
        <h4 className="subtitulo">{editando ? `Editar a ${profe.nombre}` : 'Alta de profesor'}</h4>
        <label className="campo"><span>Correo</span>
          <input type="email" required value={profe.email} readOnly={editando} onChange={(e) => setProfe({ ...profe, email: e.target.value })} />
        </label>
        <label className="campo"><span>Nombre</span>
          <input required value={profe.nombre} onChange={(e) => setProfe({ ...profe, nombre: e.target.value })} />
        </label>
        <div className="dos-columnas">
          <label className="campo"><span>Papel</span>
            <select aria-label="Papel" value={profe.rol} onChange={(e) => setProfe({ ...profe, rol: e.target.value })}>
              <option value="profesor">Profesor</option>
              <option value="admin">Administrador del centro</option>
              <option value="superadmin">Superadministrador</option>
            </select>
          </label>
          {profe.rol !== 'superadmin' ? (
            <label className="campo"><span>Centro</span>
              <select aria-label="Centro" value={profe.centro} onChange={(e) => setProfe({ ...profe, centro: e.target.value })} required>
                <option value="">Elige…</option>
                {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          ) : <span />}
        </div>
        {!editando && (
          <label className="campo"><span>Contraseña inicial (sólo si aún no tiene cuenta)</span>
            <input type="text" autoComplete="off" minLength={8} value={profe.clave} placeholder="mínimo 8 caracteres"
              onChange={(e) => setProfe({ ...profe, clave: e.target.value })} />
          </label>
        )}
        <div className="acciones">
          <button className="boton primario">{editando ? 'Guardar cambios' : 'Dar de alta'}</button>
          {editando && <button type="button" className="boton" onClick={() => { setEditando(false); setProfe(PROFE_VACIO) }}>Cancelar</button>}
        </div>
        <p className="suave pequeno">
          Si el correo ya tiene cuenta (por ejemplo, del Inventario), conserva su contraseña y no hace falta escribir otra.
          Si no, se crea la cuenta con la contraseña inicial: pásasela y que la cambie en Ajustes → Mi contraseña.
        </p>
      </form>
    </section>
  )
}
