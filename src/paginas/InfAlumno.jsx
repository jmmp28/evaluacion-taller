import { Fragment, useEffect, useMemo, useState } from 'react'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { fechaCorta, mensajeError } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import SelectorPeriodo from '../componentes/SelectorPeriodo'
import { anioCurso, resolverPeriodo } from '../informes/periodos'
import { usePeriodo } from '../informes/usePeriodo'
import { cargarRegistro, cifras, claseMedia, comentarioAlumno, fmt1, fmt2, pct, plural, trabajosAlumno } from '../informes/datos'

const fechas = (a, b) => (a === b ? fechaCorta(a).slice(0, 5) : `${fechaCorta(a).slice(0, 5)}–${fechaCorta(b).slice(0, 5)}`)

export default function InfAlumno() {
  const { grupo } = useApp()
  const anio = anioCurso(grupo.curso)
  const [periodo, setPeriodo] = usePeriodo('alumno', '1T')
  const [alumnoId, setAlumnoId] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [filas, setFilas] = useState(null)
  const [editados, setEditados] = useState({})    // alumno_id → comentario retocado
  const [error, setError] = useState('')
  const p = resolverPeriodo(periodo.id, anio, periodo)

  useEffect(() => {
    supabase.from('alumnos').select('id, apellidos_nombre, activo').eq('grupo_id', grupo.id).order('apellidos_nombre')
      .then(({ data, error: e }) => { if (e) setError(mensajeError(e)); setAlumnos(data ?? []) })
  }, [grupo.id])

  useEffect(() => {
    setFilas(null); setEditados({})
    cargarRegistro(grupo.id, p.desde, p.hasta, alumnoId ? Number(alumnoId) : undefined)
      .then(setFilas).catch((e) => setError(mensajeError(e)))
  }, [grupo.id, p.desde, p.hasta, alumnoId])

  const informes = useMemo(() => {
    if (!filas) return []
    const elegidos = alumnoId ? alumnos.filter((a) => a.id === Number(alumnoId)) : alumnos
    return elegidos.map((a) => {
      const mias = filas.filter((f) => f.alumno_id === a.id)
      const grupos = trabajosAlumno(mias)
      return { a, mias, grupos, c: cifras(mias), auto: comentarioAlumno(a.apellidos_nombre, mias, grupos) }
    })
  }, [filas, alumnos, alumnoId])

  const conNotas = informes.filter((x) => x.c.ses > 0)
  const sinNotas = informes.filter((x) => x.c.ses === 0 && x.a.activo)

  return (
    <>
      <CabeceraInforme titulo="Informe por alumno" listo={!!filas} />
      <main className="pila">
        <section className="tarjeta pila no-imprimir">
          <SelectorPeriodo valor={periodo} onCambio={setPeriodo} anio={anio} />
          <label className="campo">
            <span>Alumno</span>
            <select value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)}>
              <option value="">Todos los alumnos</option>
              {alumnos.map((a) => <option key={a.id} value={a.id}>{a.apellidos_nombre}{a.activo ? '' : ' (baja)'}</option>)}
            </select>
          </label>
          <p className="suave pequeno">El comentario se redacta solo a partir de los resultados. Puedes retocarlo antes de imprimir. Cada alumno sale en una página.</p>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        {!filas && <p className="suave">Cargando…</p>}
        {filas && conNotas.length === 0 && <p className="aviso">No hay notas en este periodo.</p>}

        {conNotas.map(({ a, grupos, c, auto }, n) => {
          const texto = editados[a.id] ?? auto
          let pAnt = null
          return (
            <article key={a.id} className={'papel' + (n > 0 ? ' salto-antes' : '')}>
              <p className="inf-sub">INFORME DE TRABAJOS · {grupo.nombre} · {grupo.curso}</p>
              <h2 className="inf-titulo">{a.apellidos_nombre}</h2>
              <p className="inf-sub">{p.texto}</p>
              <p className="inf-cifras">
                {plural(c.ses, 'sesión', 'sesiones')} · {plural(c.aus, 'falta', 'faltas')} ({pct(c.asistencia)} de asistencia) ·
                media <strong>{fmt2(c.media)}</strong> sobre 3 · nota <strong className={'nota-caja ' + claseMedia(c.media)}>{fmt1(c.nota10)}</strong>
              </p>
              <div className="tabla-scroll">
                <table className="tabla inf-tabla">
                  <thead><tr><th className="izq">Categoría</th><th className="izq">Tarea</th><th className="movil-no">Fechas</th><th>Ses.</th><th>Faltas</th><th>Media</th><th>Nota</th></tr></thead>
                  <tbody>
                    {grupos.map((g, i) => {
                      const nuevoP = g.proyecto !== pAnt
                      pAnt = g.proyecto
                      return (
                        <Fragment key={i}>
                          {nuevoP && <tr className="fila-proyecto"><td colSpan={7}>{g.proyecto}</td></tr>}
                          <tr>
                            <td className="izq sangria">{g.categoria}</td>
                            <td className="izq">{g.tarea}</td>
                            <td className="movil-no">{fechas(g.d1, g.d2)}</td>
                            <td>{g.ses}</td>
                            <td>{g.aus || ''}</td>
                            <td className={'media ' + claseMedia(g.media)}>{fmt2(g.media)}</td>
                            <td className={'media ' + claseMedia(g.media)}>{fmt1(g.nota10)}</td>
                          </tr>
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <h3 className="inf-apartado">Comentario</h3>
              <textarea className="comentario no-imprimir" rows={9} value={texto}
                onChange={(e) => setEditados((s) => ({ ...s, [a.id]: e.target.value }))} aria-label={`Comentario de ${a.apellidos_nombre}`} />
              {editados[a.id] !== undefined && editados[a.id] !== auto && (
                <button className="boton enlace no-imprimir" onClick={() => setEditados((s) => { const x = { ...s }; delete x[a.id]; return x })}>Volver al comentario automático</button>
              )}
              <p className="solo-imprimir comentario-impreso">{texto}</p>
            </article>
          )
        })}

        {!alumnoId && sinNotas.length > 0 && filas && (
          <p className="suave pequeno no-imprimir">Sin notas en este periodo: {sinNotas.map((x) => x.a.apellidos_nombre).join(' · ')}</p>
        )}
      </main>
    </>
  )
}
