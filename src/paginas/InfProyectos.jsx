import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { mensajeError } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import SelectorPeriodo from '../componentes/SelectorPeriodo'
import { anioCurso, resolverPeriodo } from '../informes/periodos'
import { usePeriodo } from '../informes/usePeriodo'
import { cargarRegistro, SIN_C, SIN_P, SIN_T } from '../informes/datos'
import { enlaces } from '../fotos'

const POR_PAGINA = 12

// columnas que recortan menos las fotos: compara la forma de cada hueco con la de las fotos
// (el hueco para fotos de la hoja es más o menos 1 de ancho por 1,15 de alto)
function columnas(fotos) {
  const n = fotos.length
  if (n <= 1) return 1
  const formas = fotos.map((f) => (f.ancho && f.alto ? f.ancho / f.alto : 4 / 3))
  let mejor = 1, menor = Infinity
  for (let c = 1; c <= Math.min(4, n); c++) {
    const filas = Math.ceil(n / c)
    if (filas * c - n >= c) continue
    const hueco = (1 / c) / (1.15 / filas)
    const recorte = formas.reduce((s, a) => s + Math.abs(Math.log(hueco / a)), 0) / n + (filas * c - n) * 0.15
    if (recorte < menor) { menor = recorte; mejor = c }
  }
  return mejor
}

export default function InfProyectos() {
  const { grupo } = useApp()
  const anio = anioCurso(grupo.curso)
  const [periodo, setPeriodo] = usePeriodo('proyectos', 'mes')
  const [elegido, setElegido] = useState('')
  const [filas, setFilas] = useState(null)
  const [fotos, setFotos] = useState([])
  const [urls, setUrls] = useState({})
  const [error, setError] = useState('')
  const p = resolverPeriodo(periodo.id, anio, periodo)

  useEffect(() => {
    let vivo = true
    setFilas(null); setError('')
    ;(async () => {
      try {
        const [fs, fo] = await Promise.all([
          cargarRegistro(grupo.id, p.desde, p.hasta),
          supabase.from('fotos').select('id, ruta, fecha, ancho, alto, descripcion, proyecto:proyectos(nombre)')
            .eq('grupo_id', grupo.id).gte('fecha', p.desde).lte('fecha', p.hasta).order('fecha').order('creado'),
        ])
        if (fo.error) throw fo.error
        if (!vivo) return
        setFilas(fs); setFotos(fo.data ?? [])
        const u = await enlaces((fo.data ?? []).map((f) => f.ruta))      // las grandes: es para imprimir
        if (vivo) setUrls(u)
      } catch (e) { if (vivo) setError(mensajeError(e)) }
    })()
    return () => { vivo = false }
  }, [grupo.id, p.desde, p.hasta])

  // proyectos del periodo (por su primer día), con sus categorías y tareas, y sus fotos
  const proyectos = useMemo(() => {
    if (!filas) return []
    const m = new Map()
    const dar = (nombre, fecha) => {
      const k = nombre.toUpperCase()
      if (!m.has(k)) m.set(k, { nombre, inicio: fecha, cats: new Map(), fotos: [] })
      const x = m.get(k)
      if (fecha < x.inicio) x.inicio = fecha
      return x
    }
    for (const f of filas) {
      if (!f.proyecto) continue
      const x = dar(f.proyecto || SIN_P, f.fecha)
      const c = f.categoria || SIN_C
      if (!x.cats.has(c)) x.cats.set(c, [])
      const t = f.tarea || SIN_T
      if (!x.cats.get(c).includes(t)) x.cats.get(c).push(t)
    }
    for (const f of fotos) dar(f.proyecto?.nombre ?? SIN_P, f.fecha).fotos.push(f)
    return [...m.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nombre.localeCompare(b.nombre, 'es'))
  }, [filas, fotos])

  useEffect(() => {
    if (elegido && proyectos.length && !proyectos.some((x) => x.nombre === elegido)) setElegido('')
  }, [proyectos, elegido])

  const lista = elegido ? proyectos.filter((x) => x.nombre === elegido) : proyectos
  // cada proyecto en una o más páginas (12 fotos por página)
  const paginas = lista.flatMap((x) => {
    const trozos = []
    for (let i = 0; i < Math.max(1, x.fotos.length); i += POR_PAGINA) trozos.push(x.fotos.slice(i, i + POR_PAGINA))
    return trozos.map((fs, k) => ({ x, fs, k, total: trozos.length }))
  })
  const listo = !!filas && fotos.every((f) => urls[f.ruta])

  return (
    <>
      <CabeceraInforme titulo="Proyectos en A4" listo={listo} />
      <main className="pila">
        <section className="tarjeta pila no-imprimir">
          <SelectorPeriodo valor={periodo} onCambio={setPeriodo} anio={anio} />
          <label className="campo">
            <span>Proyecto</span>
            <select value={elegido} onChange={(e) => setElegido(e.target.value)}>
              <option value="">Todos ({proyectos.length})</option>
              {proyectos.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}
            </select>
          </label>
          <p className="suave pequeno">Una página A4 por proyecto con sus tareas y fotos, para exponer. Si un proyecto tiene más de {POR_PAGINA} fotos, sigue en otra página.</p>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        {!filas && !error && <p className="suave">Cargando…</p>}
        {filas && paginas.length === 0 && <p className="aviso">No hay proyectos trabajados ni fotos en este periodo.</p>}

        <div className="paginas-a4">
          {paginas.map(({ x, fs, k, total }) => (
            <article key={x.nombre + k} className="hoja-a4" aria-label={`Página de ${x.nombre}`}>
              <h2 className="a4-titulo">{x.nombre}{total > 1 && k > 0 ? <span className="a4-cont"> (continuación)</span> : null}</h2>
              {k === 0 && x.cats.size > 0 && (
                <ul className="a4-tareas">
                  {[...x.cats.entries()].map(([c, ts]) => (
                    <li key={c}><strong>{c}:</strong> {ts.join(' · ')}</li>
                  ))}
                </ul>
              )}
              {fs.length > 0 ? (
                <div className="a4-fotos" style={{ gridTemplateColumns: `repeat(${columnas(fs)}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.ceil(fs.length / columnas(fs))}, minmax(0, 1fr))` }}>
                  {fs.map((f) => (
                    <figure key={f.id}>
                      {urls[f.ruta] ? <img src={urls[f.ruta]} alt={f.descripcion || ''} /> : <span className="hueco-foto" />}
                      {f.descripcion && <figcaption>{f.descripcion}</figcaption>}
                    </figure>
                  ))}
                </div>
              ) : <p className="a4-sin-fotos">Sin fotos en este periodo</p>}
            </article>
          ))}
        </div>
      </main>
    </>
  )
}
