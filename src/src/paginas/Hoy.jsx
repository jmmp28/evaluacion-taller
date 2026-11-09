import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { colorCategoria, fechaLarga, hoyISO, mensajeError, sumarDias } from '../util'
import Chip from '../componentes/Chip'
import { IcoAdelante, IcoAtras, IcoMas } from '../componentes/Iconos'

export default function Hoy() {
  const { grupo } = useApp()
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') || hoyISO()
  const ir = useNavigate()

  const [sesiones, setSesiones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [nAlumnos, setNAlumnos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(0)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const [s, c, a] = await Promise.all([
      supabase.from('sesiones')
        .select('id, numero, detalle, tarea:tareas(id, nombre, categoria_id, categoria:categorias(nombre), proyecto:proyectos(nombre)), evaluaciones(count)')
        .eq('grupo_id', grupo.id).eq('fecha', fecha).order('numero'),
      supabase.from('categorias').select('id, nombre, orden').order('orden').order('nombre'),
      supabase.from('alumnos').select('id', { count: 'exact', head: true }).eq('grupo_id', grupo.id).eq('activo', true),
    ])
    if (s.error) setError(mensajeError(s.error))
    setSesiones(s.data ?? [])
    setCategorias(c.data ?? [])
    setNAlumnos(a.count ?? 0)
    setCargando(false)
  }, [grupo.id, fecha])

  useEffect(() => { cargar() }, [cargar])

  const cambiarFecha = (f) => setParams(f === hoyISO() ? {} : { fecha: f })

  // Empezar una sesión: propone la actividad de la última sesión con ese número
  async function empezar(numero) {
    setCreando(numero); setError('')
    const previa = await supabase.from('sesiones').select('tarea_id')
      .eq('grupo_id', grupo.id).eq('numero', numero).lt('fecha', fecha)
      .not('tarea_id', 'is', null).order('fecha', { ascending: false }).limit(1)
    const tareaId = previa.data?.[0]?.tarea_id ?? null
    const { data, error: e } = await supabase.from('sesiones')
      .insert({ grupo_id: grupo.id, fecha, numero, tarea_id: tareaId }).select('id').single()
    setCreando(0)
    if (e) { setError(mensajeError(e)); cargar(); return }
    ir(`/sesion/${data.id}`)
  }

  const porNumero = Object.fromEntries(sesiones.map((s) => [s.numero, s]))
  const esHoy = fecha === hoyISO()

  return (
    <>
      <header className="cabecera">
        <p className="suave">{grupo.nombre} · {grupo.curso}</p>
        <h1 className="titulo">{esHoy ? 'Hoy' : fechaLarga(fecha)}</h1>
        <div className="selector-fecha">
          <button className="boton-icono" onClick={() => cambiarFecha(sumarDias(fecha, -1))} aria-label="Día anterior"><IcoAtras /></button>
          <label className="campo-fecha">
            <span className="sr">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => e.target.value && cambiarFecha(e.target.value)} />
          </label>
          <button className="boton-icono" onClick={() => cambiarFecha(sumarDias(fecha, 1))} aria-label="Día siguiente"><IcoAdelante /></button>
          {!esHoy && <button className="boton pequeno" onClick={() => cambiarFecha(hoyISO())}>Hoy</button>}
        </div>
        {esHoy && <p className="suave">{fechaLarga(fecha)}</p>}
      </header>

      <main className="pila">
        {error && <p className="error" role="alert">{error}</p>}
        {nAlumnos === 0 && !cargando && (
          <p className="aviso">Este grupo aún no tiene alumnos. <Link to="/alumnos">Añádelos aquí.</Link></p>
        )}
        {[1, 2, 3].map((n) => {
          const s = porNumero[n]
          if (!s) {
            return (
              <button key={n} className="tarjeta sesion vacia" onClick={() => empezar(n)} disabled={cargando || creando > 0}>
                <span className="sesion-titulo">Sesión {n}</span>
                <span className="suave fila-icono"><IcoMas /> {creando === n ? 'Creando…' : 'Empezar sesión'}</span>
              </button>
            )
          }
          const hechos = s.evaluaciones?.[0]?.count ?? 0
          const estado = hechos === 0 ? ['gris', 'Sin empezar']
            : hechos >= nAlumnos ? ['verde', `Evaluada · ${hechos}/${nAlumnos}`]
            : ['ambar', `En curso · ${hechos}/${nAlumnos}`]
          const color = s.tarea ? colorCategoria(categorias, s.tarea.categoria_id) : null
          return (
            <Link key={n} to={`/sesion/${s.id}`} className="tarjeta sesion">
              <div className="sesion-cab">
                <span className="sesion-titulo">Sesión {n}</span>
                <span className={`estado ${estado[0]}`}>{estado[1]}</span>
              </div>
              {s.tarea ? (
                <>
                  <Chip texto={s.tarea.categoria?.nombre} color={color} />
                  <span className="sesion-proyecto">{s.tarea.proyecto?.nombre}</span>
                  <span className="suave">{s.tarea.nombre}</span>
                </>
              ) : <span className="suave">Sin actividad todavía</span>}
            </Link>
          )
        })}
      </main>
    </>
  )
}
