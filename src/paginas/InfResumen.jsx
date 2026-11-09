import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { mensajeError } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import SelectorPeriodo from '../componentes/SelectorPeriodo'
import { anioCurso, opcionesPeriodo, resolverPeriodo } from '../informes/periodos'
import { usePeriodo } from '../informes/usePeriodo'
import { cargarRegistro, cifras, claseMedia, fmt1, fmt2, pct } from '../informes/datos'

const DATOS = {
  nota10: { t: 'Nota /10', f: (c) => fmt1(c.nota10), clase: (c) => claseMedia(c.media) },
  media: { t: 'Media (0–3)', f: (c) => fmt2(c.media), clase: (c) => claseMedia(c.media) },
  puntos: { t: 'Puntos', f: (c) => c.puntos },
  ses: { t: 'Sesiones', f: (c) => c.ses },
  aus: { t: 'Ausencias', f: (c) => c.aus },
  asistencia: { t: '% asistencia', f: (c) => pct(c.asistencia) },
}

export default function InfResumen() {
  const { grupo } = useApp()
  const anio = anioCurso(grupo.curso)
  const [periodo, setPeriodo] = usePeriodo('resumen', 'curso')
  const [dato, setDato] = useState('nota10')
  const [alumnos, setAlumnos] = useState([])
  const [filas, setFilas] = useState(null)
  const [filasCurso, setFilasCurso] = useState(null)
  const [error, setError] = useState('')
  const p = resolverPeriodo(periodo.id, anio, periodo)
  const o = opcionesPeriodo(anio)

  useEffect(() => {
    supabase.from('alumnos').select('id, apellidos_nombre, activo').eq('grupo_id', grupo.id).order('apellidos_nombre')
      .then(({ data, error: e }) => { if (e) setError(mensajeError(e)); setAlumnos(data ?? []) })
    cargarRegistro(grupo.id, o.curso.desde, o.curso.hasta).then(setFilasCurso).catch((e) => setError(mensajeError(e)))
  }, [grupo.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFilas(null)
    cargarRegistro(grupo.id, p.desde, p.hasta).then(setFilas).catch((e) => setError(mensajeError(e)))
  }, [grupo.id, p.desde, p.hasta])

  // alumnos activos y los de baja que tengan notas
  const lista = useMemo(() => {
    const conNotas = new Set((filasCurso ?? []).concat(filas ?? []).map((f) => f.alumno_id))
    return alumnos.filter((a) => a.activo || conNotas.has(a.id))
  }, [alumnos, filas, filasCurso])

  const porAlumno = (fs, id) => fs.filter((f) => f.alumno_id === id)
  const dias = filas ? new Set(filas.map((f) => f.fecha)).size : 0
  const columnas = [...o.trimestres, o.curso, ...o.meses]
  const D = DATOS[dato]

  return (
    <>
      <CabeceraInforme titulo="Resumen de notas" listo={!!filas} />
      <main className="pila">
        <section className="tarjeta pila no-imprimir">
          <SelectorPeriodo valor={periodo} onCambio={setPeriodo} anio={anio} />
        </section>
        {error && <p className="error" role="alert">{error}</p>}

        <article className="papel">
          <h2 className="inf-titulo">Resumen por alumno · {grupo.nombre}</h2>
          <p className="inf-sub">{p.texto} · {dias} {dias === 1 ? 'día evaluado' : 'días evaluados'}</p>
          {!filas ? <p className="suave">Cargando…</p> : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Nº</th><th className="izq">Alumno</th><th>Sesiones</th><th>Ausencias</th><th>% asist.</th><th>Media (0–3)</th><th>Nota /10</th></tr>
                </thead>
                <tbody>
                  {lista.map((a, i) => {
                    const c = cifras(porAlumno(filas, a.id))
                    return (
                      <tr key={a.id}>
                        <td>{i + 1}</td>
                        <td className="izq">{a.apellidos_nombre}{!a.activo && <span className="suave"> (baja)</span>}</td>
                        <td>{c.ses || ''}</td>
                        <td>{c.ses ? c.aus : ''}</td>
                        <td>{pct(c.asistencia)}</td>
                        <td className={'media ' + claseMedia(c.media)}>{fmt2(c.media)}</td>
                        <td className={'media ' + claseMedia(c.media)}><strong>{fmt1(c.nota10)}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="papel salto-antes">
          <div className="fila-alumno">
            <h2 className="inf-titulo">Por trimestres y meses</h2>
            <label className="campo campo-linea no-imprimir">
              <span>Mostrar</span>
              <select value={dato} onChange={(e) => setDato(e.target.value)}>
                {Object.entries(DATOS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
              </select>
            </label>
          </div>
          <p className="inf-sub">{D.t} · curso {o.curso.texto.replace('Todo el curso ', '')} · 1T oct–dic, 2T ene–mar, 3T abr–jun</p>
          {!filasCurso ? <p className="suave">Cargando…</p> : (
            <div className="tabla-scroll">
              <table className="tabla compacta">
                <thead>
                  <tr>
                    <th className="izq fija">Alumno</th>
                    {columnas.map((c) => <th key={c.id} className={c.id === 'curso' ? 'separa' : ''}>{c.corto}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const mias = porAlumno(filasCurso, a.id)
                    return (
                      <tr key={a.id}>
                        <td className="izq fija">{a.apellidos_nombre}</td>
                        {columnas.map((col) => {
                          const c = cifras(mias.filter((f) => f.fecha >= col.desde && f.fecha <= col.hasta))
                          return <td key={col.id} className={(c.ses && D.clase ? 'media ' + D.clase(c) : '') + (col.id === 'curso' ? ' separa' : '')}>{c.ses ? D.f(c) : ''}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </main>
    </>
  )
}
