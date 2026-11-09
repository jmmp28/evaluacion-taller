import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { fechaCorta, fechaLarga, hoyISO, mensajeError } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import SelectorPeriodo from '../componentes/SelectorPeriodo'
import { anioCurso, resolverPeriodo } from '../informes/periodos'
import { usePeriodo } from '../informes/usePeriodo'
import { cargarRegistro, fmt1, plural, trabajosGrupo } from '../informes/datos'
import { enlaces, rutaMini } from '../fotos'

const fechas = (a, b) => (!a ? '—' : a === b ? fechaCorta(a).slice(0, 5) : `${fechaCorta(a).slice(0, 5)}–${fechaCorta(b).slice(0, 5)}`)
const claseEstado = (e) => (e.startsWith('Real') ? 'est-real' : e.startsWith('Parc') ? 'est-parc' : e.startsWith('Pend') ? 'est-pend' : 'est-nopr')

export default function InfTrabajos() {
  const { grupo } = useApp()
  const anio = anioCurso(grupo.curso)
  const [periodo, setPeriodo] = usePeriodo('trabajos', 'mes')
  const [res, setRes] = useState(null)
  const [fotos, setFotos] = useState([])
  const [urls, setUrls] = useState({})
  const [error, setError] = useState('')
  const p = resolverPeriodo(periodo.id, anio, periodo)

  useEffect(() => {
    let vivo = true
    setRes(null); setError('')
    ;(async () => {
      try {
        const [filas, pv, fo] = await Promise.all([
          cargarRegistro(grupo.id, p.desde, p.hasta),
          supabase.from('prevision').select('sesiones_previstas, proyecto:proyectos(nombre), categoria:categorias(nombre), tarea:tareas(nombre)')
            .eq('grupo_id', grupo.id).gte('mes', p.desde.slice(0, 8) + '01').lte('mes', p.hasta),
          supabase.from('fotos').select('id, ruta, fecha, descripcion, proyecto:proyectos(nombre)')
            .eq('grupo_id', grupo.id).gte('fecha', p.desde).lte('fecha', p.hasta).order('fecha').order('creado'),
        ])
        if (pv.error) throw pv.error
        if (fo.error) throw fo.error
        const prevision = (pv.data ?? []).map((x) => ({ proyecto: x.proyecto?.nombre, categoria: x.categoria?.nombre, tarea: x.tarea?.nombre, sesiones_previstas: x.sesiones_previstas }))
        if (!vivo) return
        setRes(trabajosGrupo(filas, prevision))
        setFotos(fo.data ?? [])
        const u = await enlaces((fo.data ?? []).map((f) => rutaMini(f.ruta)))
        if (vivo) setUrls(u)
      } catch (e) { if (vivo) setError(mensajeError(e)) }
    })()
    return () => { vivo = false }
  }, [grupo.id, p.desde, p.hasta])

  const proyectos = res ? [...new Set(res.lista.map((g) => g.proyecto))] : []
  const fotosDe = (nombre) => fotos.filter((f) => (f.proyecto?.nombre ?? '').toUpperCase() === nombre.toUpperCase())

  return (
    <>
      <CabeceraInforme titulo="Trabajos del grupo" listo={!!res} />
      <main className="pila">
        <section className="tarjeta pila no-imprimir">
          <SelectorPeriodo valor={periodo} onCambio={setPeriodo} anio={anio} />
          <p className="suave pequeno">Sin notas: lo que ha hecho el grupo, comparado con la <Link to="/prevision">previsión</Link>, y las fotos de cada proyecto.</p>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        {!res && !error && <p className="suave">Cargando…</p>}

        {res && (
          <article className="papel">
            <h2 className="inf-titulo">Trabajos realizados por el grupo</h2>
            <p className="inf-sub">{grupo.nombre} · {p.texto} · generado el {fechaLarga(hoyISO()).toLowerCase()}</p>
            <p className="inf-cifras">
              {plural(res.dias, 'día', 'días')} de trabajo · {plural(res.sesiones, 'sesión', 'sesiones')} &nbsp;|&nbsp;
              Tareas: {plural(res.realizadas, 'realizada', 'realizadas')} · {plural(res.parciales, 'parcial', 'parciales')} ·{' '}
              {plural(res.pendientes, 'pendiente', 'pendientes')} · {plural(res.noPrevistas, 'no prevista', 'no previstas')}
            </p>
            {res.lista.length === 0 && <p className="suave">No hay trabajos registrados ni previstos en este periodo.</p>}

            {proyectos.map((pr) => {
              const tareas = res.lista.filter((g) => g.proyecto === pr)
              const ses = tareas.reduce((s, g) => s + g.nSes, 0)
              const dias = new Set(tareas.flatMap((g) => [...g.dias])).size
              const fs = fotosDe(pr)
              let cAnt = null
              return (
                <section key={pr} className="inf-proyecto">
                  <h3 className="inf-proyecto-titulo">{pr}</h3>
                  <p className="inf-sub sangria">
                    {ses ? `${plural(dias, 'día', 'días')} · ${plural(ses, 'sesión', 'sesiones')}` : 'Sin trabajar en este periodo'}
                    {fs.length ? ` · ${plural(fs.length, 'foto', 'fotos')}` : ''}
                  </p>
                  <div className="tabla-scroll sangria">
                    <table className="tabla inf-tabla">
                      <thead><tr><th className="izq">Categoría</th><th className="izq">Tarea</th><th className="movil-no">Fechas</th><th className="movil-no">Días</th><th>Ses.</th><th className="movil-no">Alumnos/ses.</th><th>Previsto</th><th>Estado</th></tr></thead>
                      <tbody>
                        {tareas.map((g, i) => {
                          const mismaC = g.categoria === cAnt
                          cAnt = g.categoria
                          return (
                            <Fragment key={i}>
                              <tr>
                                <td className="izq">{mismaC ? '' : g.categoria}</td>
                                <td className="izq">{g.tarea}</td>
                                <td className="movil-no">{fechas(g.d1, g.d2)}</td>
                                <td className="movil-no">{g.nDias || ''}</td>
                                <td>{g.nSes || ''}</td>
                                <td className="movil-no">{fmt1(g.alumnosSesion)}</td>
                                <td>{g.previsto < 0 ? '—' : g.previsto === 0 ? 'Sí' : plural(g.previsto, 'sesión', 'sesiones')}</td>
                                <td><span className={'estado-trabajo ' + claseEstado(g.estado)}>{g.estado}</span></td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {fs.length > 0 && (
                    <ul className="inf-fotos sangria">
                      {fs.map((f) => (
                        <li key={f.id}>
                          {urls[rutaMini(f.ruta)] ? <img src={urls[rutaMini(f.ruta)]} alt={f.descripcion || ''} /> : <span className="hueco-foto" />}
                          <span>{fechaCorta(f.fecha).slice(0, 5)}{f.descripcion ? ` · ${f.descripcion}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </article>
        )}
      </main>
    </>
  )
}
