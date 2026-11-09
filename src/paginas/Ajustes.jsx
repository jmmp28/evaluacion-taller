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

export default function Ajustes({ sinGrupos }) {
  const { sesion, profesor, esAdmin, grupos, grupo, setGrupoId, cargarGrupos, salir } = useApp()
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
      </header>
      <main className="pila">
        {sinGrupos && <p className="aviso">Aún no hay ningún grupo. Crea el primero aquí abajo.</p>}

        {grupos.length > 1 && (
          <section className="tarjeta pila">
            <h2 className="subtitulo">Grupo</h2>
            <label className="campo">
              <span>Grupo con el que trabajas</span>
              <select value={grupo?.id ?? ''} onChange={(e) => setGrupoId(Number(e.target.value))}>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.curso}</option>)}
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
            <p className="suave pequeno">Pasa a la web los alumnos, actividades, notas, previsión y fotos de tu archivo Evaluacion_diaria.ods.</p>
            <Link className="boton" to="/importar">Importar de la hoja de Calc</Link>
          </section>
        )}

        {esAdmin && <Administracion cargarGrupos={cargarGrupos} miId={sesion.user.id} />}

        <button className="boton" onClick={salir}>Cerrar sesión</button>
      </main>
    </>
  )
}

// ---------------------------------------------------------------- sólo administradores
function Administracion({ cargarGrupos, miId }) {
  const [grupos, setGrupos] = useState([])
  const [profes, setProfes] = useState([])
  const [asign, setAsign] = useState([])               // { grupo_id, user_id }
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', curso: cursoActual() })
  const [nuevoProfe, setNuevoProfe] = useState({ email: '', nombre: '', rol: 'profesor' })
  const [msg, setMsg] = useState({ error: '', aviso: '' })

  const cargar = useCallback(async () => {
    const [g, p, a] = await Promise.all([
      supabase.from('grupos').select('id, nombre, curso, activo').order('curso', { ascending: false }).order('nombre'),
      supabase.rpc('lista_profesores'),
      supabase.from('grupo_profesores').select('grupo_id, user_id'),
    ])
    const err = g.error || p.error || a.error
    if (err) setMsg({ error: mensajeError(err), aviso: '' })
    setGrupos(g.data ?? []); setProfes(p.data ?? []); setAsign(a.data ?? [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const hecho = async (error, aviso) => {
    setMsg(error ? { error: mensajeError(error), aviso: '' } : { error: '', aviso })
    await cargar(); await cargarGrupos()
  }

  async function crearGrupo(e) {
    e.preventDefault()
    if (!nuevoGrupo.nombre.trim()) return
    const { error } = await supabase.from('grupos').insert({ nombre: nuevoGrupo.nombre.trim(), curso: nuevoGrupo.curso.trim() })
    if (!error) setNuevoGrupo({ nombre: '', curso: cursoActual() })
    await hecho(error, 'Grupo creado.')
  }

  async function altaProfe(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('alta_profesor', {
      p_email: nuevoProfe.email.trim(), p_nombre: nuevoProfe.nombre.trim(), p_rol: nuevoProfe.rol,
    })
    if (!error) setNuevoProfe({ email: '', nombre: '', rol: 'profesor' })
    await hecho(error, 'Profesor dado de alta. Asígnale sus grupos.')
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

  return (
    <section className="tarjeta pila">
      <h2 className="subtitulo">Administración</h2>
      {msg.error && <p className="error" role="alert">{msg.error}</p>}
      {msg.aviso && <p className="aviso" role="status">{msg.aviso}</p>}

      <h3 className="paso">Grupos</h3>
      <ul className="lista-simple">
        {grupos.map((g) => (
          <li key={g.id} className="fila-alumno">
            <span>{g.nombre} · {g.curso}{!g.activo && <span className="suave"> (archivado)</span>}</span>
            <button className="boton pequeno" onClick={async () => {
              const { error } = await supabase.from('grupos').update({ activo: !g.activo }).eq('id', g.id)
              await hecho(error, '')
            }}>{g.activo ? 'Archivar' : 'Recuperar'}</button>
          </li>
        ))}
      </ul>
      <form className="dos-columnas" onSubmit={crearGrupo}>
        <label className="campo"><span>Nuevo grupo</span><input value={nuevoGrupo.nombre} placeholder="2.º FPB Taller" onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value })} /></label>
        <label className="campo"><span>Curso</span><input value={nuevoGrupo.curso} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, curso: e.target.value })} /></label>
        <button className="boton primario">Crear grupo</button>
      </form>

      <h3 className="paso">Profesores</h3>
      <ul className="lista-simple">
        {profes.map((p) => (
          <li key={p.user_id} className="tarjeta pila profe">
            <div className="fila-alumno">
              <span><strong>{p.nombre}</strong> <span className="suave pequeno">{p.email} · {p.rol}{!p.activo && ' · sin acceso'}</span></span>
              {p.user_id !== miId && (
                <button className="boton pequeno" onClick={async () => {
                  const { error } = await supabase.from('profesores').update({ activo: !p.activo }).eq('user_id', p.user_id)
                  await hecho(error, '')
                }}>{p.activo ? 'Quitar acceso' : 'Dar acceso'}</button>
              )}
            </div>
            {p.rol !== 'admin' && (
              <fieldset className="checks">
                <legend className="suave pequeno">Grupos</legend>
                {grupos.filter((g) => g.activo).map((g) => {
                  const si = asign.some((x) => x.user_id === p.user_id && x.grupo_id === g.id)
                  return (
                    <label key={g.id} className="check">
                      <input type="checkbox" checked={si} onChange={() => asignar(p.user_id, g.id, !si)} />
                      {g.nombre}
                    </label>
                  )
                })}
              </fieldset>
            )}
            {p.rol === 'admin' && <p className="suave pequeno">Administrador: ve todos los grupos.</p>}
          </li>
        ))}
      </ul>
      <form className="pila" onSubmit={altaProfe}>
        <p className="suave pequeno">El profesor tiene que tener ya cuenta (la del Inventario, o créala en Supabase → Authentication → Users).</p>
        <label className="campo"><span>Correo</span><input type="email" required value={nuevoProfe.email} onChange={(e) => setNuevoProfe({ ...nuevoProfe, email: e.target.value })} /></label>
        <div className="dos-columnas">
          <label className="campo"><span>Nombre</span><input required value={nuevoProfe.nombre} onChange={(e) => setNuevoProfe({ ...nuevoProfe, nombre: e.target.value })} /></label>
          <label className="campo"><span>Rol</span>
            <select value={nuevoProfe.rol} onChange={(e) => setNuevoProfe({ ...nuevoProfe, rol: e.target.value })}>
              <option value="profesor">Profesor</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>
        <button className="boton primario">Dar de alta</button>
      </form>
    </section>
  )
}
