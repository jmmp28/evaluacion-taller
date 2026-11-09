import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { CAMPOS_FOTO, enlaces, rutaMini, subirVarias } from '../fotos'
import { finDeMes, hoyISO, mensajeError, mesDe, nombreMes, sumarMeses } from '../util'
import BotonesFoto from '../componentes/BotonesFoto'
import Hoja from '../componentes/Hoja'
import VisorFoto from '../componentes/VisorFoto'
import { IcoAdelante, IcoAtras, IcoMas } from '../componentes/Iconos'

// Fotos del grupo por mes, agrupadas por proyecto.
// Salen los proyectos trabajados ese mes (aunque aún no tengan fotos) y los que tengan fotos.
export default function Fotos() {
  const { grupo } = useApp()
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') || mesDe(hoyISO())
  const desde = `${mes}-01`
  const hasta = finDeMes(mes)

  const [fotos, setFotos] = useState([])
  const [trabajados, setTrabajados] = useState([])   // { id, nombre, ultima }
  const [nombres, setNombres] = useState({})         // proyecto_id → nombre
  const [minis, setMinis] = useState({})             // ruta → url
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(null)     // { proyectoId, texto }
  const [aviso, setAviso] = useState('')
  const [visor, setVisor] = useState(null)           // { proyectoId, indice }
  const [elegirOtro, setElegirOtro] = useState(false)
  const [todos, setTodos] = useState([])
  const [extra, setExtra] = useState([])             // proyectos añadidos a mano este mes

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const [f, s] = await Promise.all([
      supabase.from('fotos').select(CAMPOS_FOTO + ', proyecto:proyectos(nombre)')
        .eq('grupo_id', grupo.id).gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('creado'),
      supabase.from('sesiones').select('fecha, tarea:tareas(proyecto:proyectos(id, nombre))')
        .eq('grupo_id', grupo.id).gte('fecha', desde).lte('fecha', hasta).not('tarea_id', 'is', null),
    ])
    const err = f.error || s.error
    if (err) setError(mensajeError(err))
    const lista = f.data ?? []
    const vistos = {}
    for (const x of s.data ?? []) {
      const p = x.tarea?.proyecto
      if (!p) continue
      if (!vistos[p.id] || vistos[p.id].ultima < x.fecha) vistos[p.id] = { id: p.id, nombre: p.nombre, ultima: x.fecha }
    }
    const nom = Object.fromEntries(Object.values(vistos).map((p) => [p.id, p.nombre]))
    for (const x of lista) nom[x.proyecto_id] = x.proyecto?.nombre ?? '¿?'
    setFotos(lista); setTrabajados(Object.values(vistos)); setNombres((n) => ({ ...n, ...nom }))
    setCargando(false)
    try { setMinis(await enlaces(lista.map((x) => rutaMini(x.ruta)))) } catch (e) { setError(mensajeError(e)) }
  }, [grupo.id, desde, hasta])

  useEffect(() => { setExtra([]); cargar() }, [cargar])

  // proyectos que se muestran, por nombre
  const proyectos = useMemo(() => {
    const ids = new Set([...trabajados.map((p) => p.id), ...fotos.map((f) => f.proyecto_id), ...extra])
    return [...ids].map((id) => ({ id, nombre: nombres[id] ?? '¿?' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [trabajados, fotos, extra, nombres])

  const fotosDe = (id) => fotos.filter((f) => f.proyecto_id === id)

  // fecha que se pone a las fotos nuevas: hoy si es este mes; si no, el último día que se trabajó en el proyecto
  const fechaPara = (id) => {
    const hoy = hoyISO()
    if (mesDe(hoy) === mes) return hoy
    return trabajados.find((p) => p.id === id)?.ultima ?? hasta
  }

  async function subir(proyectoId, archivos) {
    setAviso(''); setError('')
    const { hechas, fallos } = await subirVarias(archivos, { grupoId: grupo.id, proyectoId, fecha: fechaPara(proyectoId) },
      (n, total) => setSubiendo({ proyectoId, texto: total > 1 ? `Subiendo ${n} de ${total}…` : 'Subiendo…' }))
    setSubiendo(null)
    if (hechas.length) setAviso(`${hechas.length === 1 ? 'Foto guardada' : `${hechas.length} fotos guardadas`} en ${nombres[proyectoId]}.`)
    if (fallos.length) setError(`No se han podido subir: ${fallos.join(' · ')}`)
    await cargar()
  }

  async function abrirOtro() {
    setElegirOtro(true)
    const { data, error: e } = await supabase.from('proyectos').select('id, nombre').eq('activo', true).order('nombre')
    if (e) setError(mensajeError(e))
    setTodos(data ?? [])
  }

  function anadirProyecto(p) {
    setElegirOtro(false)
    setNombres((n) => ({ ...n, [p.id]: p.nombre }))
    setExtra((l) => (l.includes(p.id) ? l : [...l, p.id]))
  }

  const cambiar = (f) => {
    setFotos((l) => l.map((x) => (x.id === f.id ? { ...x, ...f } : x)))
    if (f.fecha < desde || f.fecha > hasta) { setVisor(null); cargar() }
    else enlaces([rutaMini(f.ruta)]).then((m) => setMinis((s) => ({ ...s, ...m }))).catch(() => {})
  }

  const cambiarMes = (m) => setParams(m === mesDe(hoyISO()) ? {} : { mes: m })

  return (
    <>
      <header className="cabecera">
        <p className="suave">{grupo.nombre} · {grupo.curso}</p>
        <h1 className="titulo">Fotos</h1>
        <div className="selector-fecha">
          <button className="boton-icono" onClick={() => cambiarMes(sumarMeses(mes, -1))} aria-label="Mes anterior"><IcoAtras /></button>
          <strong className="mes">{nombreMes(mes)}</strong>
          <button className="boton-icono" onClick={() => cambiarMes(sumarMeses(mes, 1))} aria-label="Mes siguiente"><IcoAdelante /></button>
          {mes !== mesDe(hoyISO()) && <button className="boton pequeno" onClick={() => cambiarMes(mesDe(hoyISO()))}>Este mes</button>}
        </div>
      </header>

      <main className="pila">
        {error && <p className="error" role="alert">{error}</p>}
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        {!cargando && proyectos.length === 0 && (
          <p className="suave">Este mes no hay sesiones con actividad ni fotos. Puedes añadir fotos a cualquier proyecto con el botón de abajo.</p>
        )}

        {proyectos.map((p) => {
          const lista = fotosDe(p.id)
          const sube = subiendo?.proyectoId === p.id
          return (
            <section key={p.id} className="tarjeta pila" aria-label={p.nombre}>
              <div className="fila-alumno">
                <h2 className="subtitulo proyecto-titulo">{p.nombre}</h2>
                <span className="suave pequeno">{lista.length ? `${lista.length} foto${lista.length === 1 ? '' : 's'}` : 'Sin fotos'}</span>
              </div>
              {lista.length > 0 && (
                <ul className="rejilla-fotos">
                  {lista.map((f, n) => (
                    <li key={f.id}>
                      <button className="miniatura" onClick={() => setVisor({ proyectoId: p.id, indice: n })}
                        aria-label={`Ver foto ${n + 1} de ${p.nombre}${f.descripcion ? ': ' + f.descripcion : ''}`}>
                        {minis[rutaMini(f.ruta)] ? <img src={minis[rutaMini(f.ruta)]} alt="" loading="lazy" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {sube
                ? <p className="suave" role="status">{subiendo.texto}</p>
                : <BotonesFoto pequeno desactivado={!!subiendo} onArchivos={(a) => subir(p.id, a)} />}
            </section>
          )
        })}

        <button className="boton discontinuo" onClick={abrirOtro} disabled={!!subiendo}><IcoMas /> Fotos de otro proyecto</button>
        <p className="suave pequeno">Las fotos se reducen en el móvil antes de subirlas (unos 300 KB cada una) y sólo las ven los profesores del grupo.</p>
      </main>

      {elegirOtro && (
        <Hoja titulo="Elige el proyecto" onCerrar={() => setElegirOtro(false)}>
          <div className="lista-opciones">
            {todos.map((p) => <button key={p.id} className="opcion" onClick={() => anadirProyecto(p)}>{p.nombre}</button>)}
            {todos.length === 0 && <p className="suave">No hay proyectos. Créalos al elegir la actividad de una sesión.</p>}
          </div>
        </Hoja>
      )}

      {visor && fotosDe(visor.proyectoId).length > 0 && (
        <VisorFoto fotos={fotosDe(visor.proyectoId)} inicial={visor.indice} titulo={nombres[visor.proyectoId]}
          grupoId={grupo.id} onCambio={cambiar} onCerrar={() => setVisor(null)}
          onBorrada={(id) => setFotos((l) => l.filter((x) => x.id !== id))} />
      )}
    </>
  )
}
