import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { hoyISO, mensajeError, mesDe, nombreMes, sumarMeses } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import { IcoAdelante, IcoAtras } from '../componentes/Iconos'

const VACIO = { proyecto_id: '', categoria_id: '', tarea_id: '', sesiones_previstas: '', notas: '' }

// Lo previsto para cada mes. Proyecto obligatorio; si la categoría o la tarea
// quedan en blanco, vale cualquier trabajo de ese proyecto (o de esa categoría).
export default function Prevision() {
  const { grupo } = useApp()
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') || mesDe(hoyISO())
  const [filas, setFilas] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tareas, setTareas] = useState([])
  const [nueva, setNueva] = useState(VACIO)
  const [msg, setMsg] = useState({ error: '', aviso: '' })

  useEffect(() => {
    Promise.all([
      supabase.from('proyectos').select('id, nombre, activo').order('nombre'),
      supabase.from('categorias').select('id, nombre').order('orden').order('nombre'),
      supabase.from('tareas').select('id, nombre, categoria_id, proyecto_id').order('nombre'),
    ]).then(([p, c, t]) => {
      const e = p.error || c.error || t.error
      if (e) setMsg({ error: mensajeError(e), aviso: '' })
      setProyectos(p.data ?? []); setCategorias(c.data ?? []); setTareas(t.data ?? [])
    })
  }, [])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('prevision')
      .select('id, proyecto_id, categoria_id, tarea_id, sesiones_previstas, notas, proyecto:proyectos(nombre), categoria:categorias(nombre), tarea:tareas(nombre)')
      .eq('grupo_id', grupo.id).eq('mes', `${mes}-01`).order('id')
    if (error) setMsg({ error: mensajeError(error), aviso: '' })
    setFilas(data ?? [])
  }, [grupo.id, mes])

  useEffect(() => { cargar() }, [cargar])

  // categorías y tareas que existen para el proyecto elegido
  const catsProyecto = useMemo(() => {
    const ids = new Set(tareas.filter((t) => t.proyecto_id === Number(nueva.proyecto_id)).map((t) => t.categoria_id))
    return categorias.filter((c) => ids.has(c.id))
  }, [tareas, categorias, nueva.proyecto_id])
  const tareasFiltro = tareas.filter((t) => t.proyecto_id === Number(nueva.proyecto_id) &&
    (!nueva.categoria_id || t.categoria_id === Number(nueva.categoria_id)))

  async function anadir(e) {
    e.preventDefault()
    if (!nueva.proyecto_id) { setMsg({ error: 'Elige el proyecto.', aviso: '' }); return }
    const t = tareas.find((x) => x.id === Number(nueva.tarea_id))
    const { error } = await supabase.from('prevision').insert({
      grupo_id: grupo.id, mes: `${mes}-01`, proyecto_id: Number(nueva.proyecto_id),
      categoria_id: nueva.categoria_id ? Number(nueva.categoria_id) : t?.categoria_id ?? null,
      tarea_id: nueva.tarea_id ? Number(nueva.tarea_id) : null,
      sesiones_previstas: nueva.sesiones_previstas ? Number(nueva.sesiones_previstas) : null,
      notas: nueva.notas.trim() || null,
    })
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    setNueva({ ...VACIO, proyecto_id: nueva.proyecto_id })
    setMsg({ error: '', aviso: 'Añadido.' })
    cargar()
  }

  async function quitar(id) {
    const { error } = await supabase.from('prevision').delete().eq('id', id)
    if (error) setMsg({ error: mensajeError(error), aviso: '' })
    cargar()
  }

  async function copiarAnterior() {
    const ant = sumarMeses(mes, -1)
    const { data, error } = await supabase.from('prevision').select('proyecto_id, categoria_id, tarea_id, sesiones_previstas, notas')
      .eq('grupo_id', grupo.id).eq('mes', `${ant}-01`)
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    if (!data.length) { setMsg({ error: `${nombreMes(ant)} no tiene previsión.`, aviso: '' }); return }
    const { error: e2 } = await supabase.from('prevision').insert(data.map((x) => ({ ...x, grupo_id: grupo.id, mes: `${mes}-01` })))
    if (e2) { setMsg({ error: mensajeError(e2), aviso: '' }); return }
    setMsg({ error: '', aviso: `Copiadas ${data.length} filas de ${nombreMes(ant).toLowerCase()}.` })
    cargar()
  }

  const cambiarMes = (m) => setParams(m === mesDe(hoyISO()) ? {} : { mes: m })
  const campo = (k) => ({ value: nueva[k], onChange: (e) => setNueva({ ...nueva, [k]: e.target.value }) })

  return (
    <>
      <CabeceraInforme titulo="Previsión" imprimir={false} />
      <main className="pila">
        <div className="selector-fecha">
          <button className="boton-icono" onClick={() => cambiarMes(sumarMeses(mes, -1))} aria-label="Mes anterior"><IcoAtras /></button>
          <strong className="mes">{nombreMes(mes)}</strong>
          <button className="boton-icono" onClick={() => cambiarMes(sumarMeses(mes, 1))} aria-label="Mes siguiente"><IcoAdelante /></button>
        </div>
        {msg.error && <p className="error" role="alert">{msg.error}</p>}
        {msg.aviso && <p className="aviso" role="status">{msg.aviso}</p>}

        <ul className="lista-simple" aria-label="Previsto este mes">
          {filas.map((f) => (
            <li key={f.id} className="tarjeta fila-alumno">
              <span className="pila sin-relleno apretada">
                <strong>{f.proyecto?.nombre}</strong>
                <span className="suave pequeno">
                  {f.categoria?.nombre ?? 'cualquier categoría'} › {f.tarea?.nombre ?? 'cualquier tarea'}
                  {f.sesiones_previstas ? ` · ${f.sesiones_previstas} ses.` : ''}{f.notas ? ` · ${f.notas}` : ''}
                </span>
              </span>
              <button className="boton pequeno" onClick={() => quitar(f.id)} aria-label={`Quitar ${f.proyecto?.nombre} ${f.tarea?.nombre ?? ''}`}>Quitar</button>
            </li>
          ))}
          {filas.length === 0 && (
            <li className="pila sin-relleno">
              <p className="suave">No hay nada previsto para {nombreMes(mes).toLowerCase()}.</p>
              <button className="boton pequeno" onClick={copiarAnterior}>Copiar la previsión de {nombreMes(sumarMeses(mes, -1)).toLowerCase()}</button>
            </li>
          )}
        </ul>

        <form className="tarjeta pila" onSubmit={anadir}>
          <h2 className="subtitulo">Añadir a {nombreMes(mes).toLowerCase()}</h2>
          <label className="campo"><span>Proyecto</span>
            <select value={nueva.proyecto_id} onChange={(e) => setNueva({ ...VACIO, proyecto_id: e.target.value })}>
              <option value="">Elige…</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <div className="dos-columnas">
            <label className="campo"><span>Categoría</span>
              <select value={nueva.categoria_id} onChange={(e) => setNueva({ ...nueva, categoria_id: e.target.value, tarea_id: '' })} disabled={!nueva.proyecto_id}>
                <option value="">Cualquiera</option>
                {catsProyecto.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="campo"><span>Tarea</span>
              <select {...campo('tarea_id')} disabled={!nueva.proyecto_id}>
                <option value="">Cualquiera</option>
                {tareasFiltro.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="dos-columnas">
            <label className="campo"><span>Sesiones previstas</span><input type="number" min="1" inputMode="numeric" placeholder="opcional" {...campo('sesiones_previstas')} /></label>
            <label className="campo"><span>Notas</span><input placeholder="opcional" {...campo('notas')} /></label>
          </div>
          <button className="boton primario">Añadir</button>
          <p className="suave pequeno">Si dejas la categoría o la tarea en «Cualquiera», cuenta cualquier trabajo de ese proyecto. Con «Sesiones previstas», el informe dice «Parcial (3 de 5)» si se hicieron menos. Los proyectos y tareas nuevos se crean al elegir la actividad de una sesión.</p>
        </form>
      </main>
    </>
  )
}
