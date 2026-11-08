import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { COLOR_NOTA, VALORES_NOTA, colorCategoria, fechaLarga, hoyISO, mensajeError, valorDe } from '../util'
import Chip from '../componentes/Chip'
import Hoja from '../componentes/Hoja'
import SelectorActividad from '../componentes/SelectorActividad'
import { IcoAtras } from '../componentes/Iconos'

const CAMPOS_EV = 'id, alumno_id, nota, ausente, observacion'

export default function Sesion() {
  const { id } = useParams()
  const sesionId = Number(id)
  const ir = useNavigate()

  const [sesion, setSesion] = useState(null)
  const [alumnos, setAlumnos] = useState([])
  const [evs, setEvs] = useState({})                 // alumno_id → evaluación
  const [auto, setAuto] = useState({})               // nota → observación automática
  const [observaciones, setObservaciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [estadoAlumno, setEstadoAlumno] = useState({}) // alumno_id → 'guardando' | 'error'
  const [error, setError] = useState('')
  const [verSelector, setVerSelector] = useState(false)
  const [obsDe, setObsDe] = useState(null)           // alumno_id con la hoja de observación abierta
  const [obsOtra, setObsOtra] = useState('')
  const [detalle, setDetalle] = useState('')

  const cargarCategorias = useCallback(async () => {
    const { data } = await supabase.from('categorias').select('id, nombre, orden').order('orden').order('nombre')
    setCategorias(data ?? [])
  }, [])

  const cargarSesion = useCallback(async () => {
    const { data, error: e } = await supabase.from('sesiones')
      .select('id, fecha, numero, detalle, grupo_id, tarea:tareas(id, nombre, categoria_id, proyecto_id, categoria:categorias(nombre), proyecto:proyectos(nombre))')
      .eq('id', sesionId).maybeSingle()
    if (e) setError(mensajeError(e))
    setSesion(data)
    setDetalle(data?.detalle ?? '')
    return data
  }, [sesionId])

  useEffect(() => {
    ;(async () => {
      const s = await cargarSesion()
      if (!s) return
      const [al, ev, an, ob] = await Promise.all([
        supabase.from('alumnos').select('id, apellidos_nombre, activo, orden').eq('grupo_id', s.grupo_id)
          .order('orden', { nullsFirst: false }).order('apellidos_nombre'),
        supabase.from('evaluaciones').select(CAMPOS_EV).eq('sesion_id', sesionId),
        supabase.from('observacion_por_nota').select('nota, observacion'),
        supabase.from('observaciones').select('texto').order('orden').order('texto'),
      ])
      const porAlumno = Object.fromEntries((ev.data ?? []).map((e) => [e.alumno_id, e]))
      // activos, y los dados de baja sólo si ya tienen nota en esta sesión
      setAlumnos((al.data ?? []).filter((a) => a.activo || porAlumno[a.id]))
      setEvs(porAlumno)
      setAuto(Object.fromEntries((an.data ?? []).map((x) => [x.nota, x.observacion])))
      setObservaciones((ob.data ?? []).map((x) => x.texto))
    })()
    cargarCategorias()
  }, [sesionId, cargarSesion, cargarCategorias])

  const autos = useMemo(() => new Set(Object.values(auto).filter(Boolean)), [auto])

  async function guardar(alumnoId, fila, anterior) {
    setEstadoAlumno((s) => ({ ...s, [alumnoId]: 'guardando' }))
    const { data, error: e } = await supabase.from('evaluaciones')
      .upsert(fila, { onConflict: 'sesion_id,alumno_id' }).select(CAMPOS_EV).single()
    if (e) {
      setEvs((s) => ({ ...s, [alumnoId]: anterior }))
      setEstadoAlumno((s) => ({ ...s, [alumnoId]: 'error' }))
      setError(mensajeError(e))
      return
    }
    setEvs((s) => ({ ...s, [alumnoId]: data }))
    setEstadoAlumno((s) => ({ ...s, [alumnoId]: undefined }))
  }

  // Tocar una nota: la guarda al momento. Tocar la misma otra vez la quita.
  async function poner(alumnoId, valor) {
    setError('')
    const ev = evs[alumnoId]
    if (valorDe(ev) === valor) {
      setEvs((s) => { const n = { ...s }; delete n[alumnoId]; return n })
      const { error: e } = await supabase.from('evaluaciones').delete().eq('sesion_id', sesionId).eq('alumno_id', alumnoId)
      if (e) { setEvs((s) => ({ ...s, [alumnoId]: ev })); setError(mensajeError(e)) }
      return
    }
    // la observación sólo cambia sola si estaba vacía o era la automática
    const obs = !ev?.observacion || autos.has(ev.observacion) ? (auto[valor] ?? null) : ev.observacion
    const fila = { sesion_id: sesionId, alumno_id: alumnoId, nota: valor === 'A' ? null : Number(valor), ausente: valor === 'A', observacion: obs }
    setEvs((s) => ({ ...s, [alumnoId]: { ...ev, ...fila } }))
    await guardar(alumnoId, fila, ev)
  }

  async function ponerObservacion(texto) {
    const alumnoId = obsDe
    const ev = evs[alumnoId]
    setObsDe(null); setObsOtra('')
    if (!ev) return
    const fila = { sesion_id: sesionId, alumno_id: alumnoId, nota: ev.nota, ausente: ev.ausente, observacion: texto || null }
    setEvs((s) => ({ ...s, [alumnoId]: { ...ev, observacion: fila.observacion } }))
    await guardar(alumnoId, fila, ev)
  }

  async function elegirActividad(tareaId) {
    setVerSelector(false)
    const { error: e } = await supabase.from('sesiones').update({ tarea_id: tareaId }).eq('id', sesionId)
    if (e) setError(mensajeError(e))
    await cargarSesion()
  }

  async function guardarDetalle() {
    if ((sesion.detalle ?? '') === detalle.trim()) return
    const { error: e } = await supabase.from('sesiones').update({ detalle: detalle.trim() || null }).eq('id', sesionId)
    if (e) setError(mensajeError(e))
    else setSesion((s) => ({ ...s, detalle: detalle.trim() || null }))
  }

  async function borrarSesion() {
    const n = Object.keys(evs).length
    if (!window.confirm(`¿Borrar la sesión ${sesion.numero}${n ? ` y sus ${n} notas` : ''}? No se puede deshacer.`)) return
    const { error: e } = await supabase.from('sesiones').delete().eq('id', sesionId)
    if (e) { setError(mensajeError(e)); return }
    volver()
  }

  const volver = () => ir(sesion && sesion.fecha !== hoyISO() ? `/?fecha=${sesion.fecha}` : '/')

  if (sesion === null) {
    return <main className="pila"><p className="suave">{error || 'Cargando…'}</p><Link to="/">Volver</Link></main>
  }

  const t = sesion.tarea
  const evaluados = alumnos.filter((a) => evs[a.id]).length

  return (
    <>
      <header className="cabecera con-atras">
        <button className="boton-icono" onClick={volver} aria-label="Volver"><IcoAtras /></button>
        <div>
          <h1 className="titulo">Sesión {sesion.numero}</h1>
          <p className="suave">{fechaLarga(sesion.fecha)}</p>
        </div>
      </header>

      <main className="pila">
        <section className="tarjeta actividad" aria-label="Actividad de la sesión">
          <div className="actividad-texto">
            {t ? (
              <>
                <Chip texto={t.categoria?.nombre} color={colorCategoria(categorias, t.categoria_id)} />
                <span className="sesion-proyecto">{t.proyecto?.nombre} <span className="suave">› {t.nombre}</span></span>
              </>
            ) : <span className="suave">Elige qué se ha hecho en esta sesión</span>}
          </div>
          <button className="boton pequeno" onClick={() => setVerSelector(true)}>{t ? 'Cambiar' : 'Elegir'}</button>
        </section>
        <label className="campo">
          <span>Detalle (opcional)</span>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)} onBlur={guardarDetalle} placeholder="Hora, material, observaciones de la sesión…" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        {alumnos.length === 0 && <p className="aviso">No hay alumnos. <Link to="/alumnos">Añádelos aquí.</Link></p>}

        <ul className="lista-alumnos" aria-label="Alumnos">
          {alumnos.map((a) => {
            const ev = evs[a.id]
            const v = valorDe(ev)
            const est = estadoAlumno[a.id]
            return (
              <li key={a.id} className="tarjeta alumno">
                <div className="alumno-cab">
                  <span className="alumno-nombre">{a.apellidos_nombre}</span>
                  {ev ? (
                    <button className="obs" onClick={() => setObsDe(a.id)} aria-label={`Observación de ${a.apellidos_nombre}: ${ev.observacion || 'ninguna'}. Cambiar`}>
                      {ev.observacion || '+ observación'}
                    </button>
                  ) : <span className="suave pequeno">Sin evaluar</span>}
                </div>
                <div className="notas" role="group" aria-label={`Nota de ${a.apellidos_nombre}`}>
                  {VALORES_NOTA.map((n) => (
                    <button key={n} aria-pressed={v === n} aria-label={n === 'A' ? 'Ausente' : `Nota ${n}`}
                      className="nota" onClick={() => poner(a.id, n)}
                      style={v === n ? { background: COLOR_NOTA[n], borderColor: COLOR_NOTA[n], color: '#fff' } : undefined}>
                      {n}
                    </button>
                  ))}
                </div>
                {est === 'error' && <p className="error pequeno">No se ha guardado. Toca otra vez.</p>}
              </li>
            )
          })}
        </ul>

        <button className="boton peligro" onClick={borrarSesion}>Borrar esta sesión</button>
      </main>

      <footer className="pie-fijo">
        <div>
          <strong>{evaluados} de {alumnos.length} evaluados</strong>
          <p className="suave pequeno">Se guarda solo · A = ausente (cuenta 0)</p>
        </div>
        <button className="boton primario" onClick={volver}>Listo</button>
      </footer>

      {verSelector && (
        <SelectorActividad tareaActual={t} categorias={categorias} onCatalogo={cargarCategorias}
          onElegir={elegirActividad} onCerrar={() => setVerSelector(false)} />
      )}

      {obsDe && (
        <Hoja titulo="Observación" onCerrar={() => setObsDe(null)}>
          <div className="lista-opciones">
            {observaciones.map((o) => (
              <button key={o} className={'opcion' + (evs[obsDe]?.observacion === o ? ' sel' : '')} onClick={() => ponerObservacion(o)}>{o}</button>
            ))}
          </div>
          <form className="fila-nuevo" onSubmit={(e) => { e.preventDefault(); if (obsOtra.trim()) ponerObservacion(obsOtra.trim()) }}>
            <label className="sr" htmlFor="obs-otra">Otra observación</label>
            <input id="obs-otra" placeholder="Escribe otra…" value={obsOtra} onChange={(e) => setObsOtra(e.target.value)} />
            <button className="boton primario pequeno">Poner</button>
          </form>
          <button className="boton enlace" onClick={() => ponerObservacion(null)}>Quitar la observación</button>
        </Hoja>
      )}
    </>
  )
}
