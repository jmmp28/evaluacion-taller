import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { colorCategoria, mensajeError } from '../util'
import Hoja from './Hoja'
import { IcoCheck, IcoMas } from './Iconos'

// Elegir CATEGORÍA → PROYECTO → TAREA (o crear nuevas). Devuelve el id de la tarea.
export default function SelectorActividad({ tareaActual, categorias, onCatalogo, onElegir, onCerrar }) {
  const [tareas, setTareas] = useState([])
  const [catId, setCatId] = useState(tareaActual?.categoria_id ?? null)
  const [proy, setProy] = useState(tareaActual?.proyecto ? { id: tareaActual.proyecto_id, nombre: tareaActual.proyecto.nombre } : null)
  const [tareaId, setTareaId] = useState(tareaActual?.id ?? null)
  const [proyNuevos, setProyNuevos] = useState([])   // proyectos creados aquí y aún sin tareas
  const [nuevo, setNuevo] = useState({ tipo: null, texto: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('tareas').select('id, nombre, categoria_id, proyecto_id, proyecto:proyectos(id, nombre, activo)')
      .order('nombre').then(({ data, error: e }) => { if (e) setError(mensajeError(e)); setTareas(data ?? []) })
  }, [])

  const proyectos = useMemo(() => {
    const m = new Map()
    tareas.filter((t) => t.categoria_id === catId && (t.proyecto?.activo || t.proyecto_id === proy?.id))
      .forEach((t) => m.set(t.proyecto_id, t.proyecto))
    proyNuevos.forEach((p) => m.set(p.id, p))
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [tareas, catId, proy, proyNuevos])

  const tareasProy = tareas.filter((t) => t.categoria_id === catId && t.proyecto_id === proy?.id)
  const cat = categorias.find((c) => c.id === catId)

  const abrirNuevo = (tipo) => { setNuevo({ tipo, texto: '' }); setError('') }

  async function crear() {
    const texto = nuevo.texto.trim()
    if (!texto) return
    setGuardando(true); setError('')
    try {
      if (nuevo.tipo === 'categoria') {
        const nombre = texto.toUpperCase()
        let c = categorias.find((x) => x.nombre.toUpperCase() === nombre)
        if (!c) {
          const orden = Math.max(0, ...categorias.map((x) => x.orden ?? 0)) + 1
          const r = await supabase.from('categorias').insert({ nombre, orden }).select('id, nombre, orden').single()
          if (r.error) throw r.error
          c = r.data
          await onCatalogo()
        }
        setCatId(c.id); setProy(null); setTareaId(null)
      } else if (nuevo.tipo === 'proyecto') {
        const nombre = texto.toUpperCase()
        let r = await supabase.from('proyectos').select('id, nombre, activo').eq('nombre', nombre).maybeSingle()
        if (r.error) throw r.error
        if (!r.data) {
          r = await supabase.from('proyectos').insert({ nombre }).select('id, nombre, activo').single()
          if (r.error) throw r.error
        }
        setProyNuevos((l) => [...l.filter((p) => p.id !== r.data.id), r.data])
        setProy(r.data); setTareaId(null)
      } else if (nuevo.tipo === 'tarea') {
        let t = tareasProy.find((x) => x.nombre.toLowerCase() === texto.toLowerCase())
        if (!t) {
          const r = await supabase.from('tareas').insert({ categoria_id: catId, proyecto_id: proy.id, nombre: texto })
            .select('id, nombre, categoria_id, proyecto_id, proyecto:proyectos(id, nombre, activo)').single()
          if (r.error) throw r.error
          t = r.data
          setTareas((l) => [...l, t])
        }
        setTareaId(t.id)
      }
      setNuevo({ tipo: null, texto: '' })
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const formNuevo = (tipo, etiqueta) => nuevo.tipo === tipo ? (
    <form className="fila-nuevo" onSubmit={(e) => { e.preventDefault(); crear() }}>
      <label className="sr" htmlFor={`nuevo-${tipo}`}>{etiqueta}</label>
      <input id={`nuevo-${tipo}`} autoFocus placeholder={etiqueta} value={nuevo.texto}
        onChange={(e) => setNuevo({ tipo, texto: e.target.value })} />
      <button className="boton primario pequeno" disabled={guardando}>Añadir</button>
      <button type="button" className="boton pequeno" onClick={() => setNuevo({ tipo: null, texto: '' })}>Cancelar</button>
    </form>
  ) : (
    <button className="boton discontinuo" onClick={() => abrirNuevo(tipo)}><IcoMas /> {etiqueta}</button>
  )

  const resumen = [cat?.nombre, proy?.nombre, tareas.find((t) => t.id === tareaId)?.nombre].filter(Boolean).join(' › ')

  return (
    <Hoja titulo="Actividad de la sesión" onCerrar={onCerrar} pie={(
      <>
        <p className="resumen">{resumen || 'Elige una categoría'}</p>
        <button className="boton primario ancho" disabled={!tareaId} onClick={() => onElegir(tareaId)}>Usar esta actividad</button>
      </>
    )}>
      {error && <p className="error" role="alert">{error}</p>}

      <h3 className="paso">1 · Categoría</h3>
      <div className="fila-chips">
        {categorias.map((c) => {
          const col = colorCategoria(categorias, c.id)
          const sel = c.id === catId
          return (
            <button key={c.id} aria-pressed={sel} className="chip-boton"
              style={sel ? { background: col.fuerte, color: '#fff', borderColor: col.fuerte } : { background: col.claro, color: col.texto, borderColor: col.claro }}
              onClick={() => { setCatId(c.id); setProy(null); setTareaId(null) }}>
              {c.nombre}
            </button>
          )
        })}
      </div>
      {formNuevo('categoria', 'Nueva categoría')}

      {catId && (
        <>
          <h3 className="paso">2 · Proyecto</h3>
          <div className="lista-opciones">
            {proyectos.map((p) => (
              <button key={p.id} aria-pressed={p.id === proy?.id} className={'opcion' + (p.id === proy?.id ? ' sel' : '')}
                onClick={() => { setProy(p); setTareaId(null) }}>
                {p.nombre}{p.id === proy?.id && <IcoCheck />}
              </button>
            ))}
            {proyectos.length === 0 && <p className="suave">Esta categoría aún no tiene proyectos.</p>}
          </div>
          {formNuevo('proyecto', 'Nuevo proyecto')}
        </>
      )}

      {catId && proy && (
        <>
          <h3 className="paso">3 · Tarea realizada</h3>
          <div className="lista-opciones">
            {tareasProy.map((t) => (
              <button key={t.id} aria-pressed={t.id === tareaId} className={'opcion' + (t.id === tareaId ? ' sel' : '')}
                onClick={() => setTareaId(t.id)}>
                {t.nombre}{t.id === tareaId && <IcoCheck />}
              </button>
            ))}
            {tareasProy.length === 0 && <p className="suave">Aún no hay tareas: añade la primera.</p>}
          </div>
          {formNuevo('tarea', 'Nueva tarea')}
        </>
      )}
    </Hoja>
  )
}
