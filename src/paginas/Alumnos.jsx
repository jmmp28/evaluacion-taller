import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexto'
import { supabase } from '../supabase'
import { mensajeError } from '../util'

export default function Alumnos() {
  const { grupo, esAdmin } = useApp()
  const [alumnos, setAlumnos] = useState([])
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(null)      // { id, nombre }
  const [verBajas, setVerBajas] = useState(false)
  const [msg, setMsg] = useState({ error: '', aviso: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('alumnos').select('id, apellidos_nombre, activo')
      .eq('grupo_id', grupo.id).order('apellidos_nombre')
    if (error) setMsg({ error: mensajeError(error), aviso: '' })
    setAlumnos(data ?? [])
  }, [grupo.id])

  useEffect(() => { cargar() }, [cargar])

  // Pega la lista (uno por línea, «Apellidos, Nombre»)
  async function anadir(e) {
    e.preventDefault()
    const existentes = new Set(alumnos.map((a) => a.apellidos_nombre.toLowerCase()))
    const nombres = [...new Set(texto.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean))]
      .filter((n) => !existentes.has(n.toLowerCase()))
    if (nombres.length === 0) { setMsg({ error: 'No hay nombres nuevos que añadir.', aviso: '' }); return }
    const { error } = await supabase.from('alumnos').insert(nombres.map((n) => ({ grupo_id: grupo.id, apellidos_nombre: n })))
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    setTexto('')
    setMsg({ error: '', aviso: `Añadidos ${nombres.length} alumno${nombres.length === 1 ? '' : 's'}.` })
    cargar()
  }

  async function cambiarActivo(a) {
    const { error } = await supabase.from('alumnos').update({ activo: !a.activo }).eq('id', a.id)
    if (error) setMsg({ error: mensajeError(error), aviso: '' })
    cargar()
  }

  // Borrar del todo (sólo administradores y sólo alumnos ya dados de baja): se borran también sus notas
  async function borrar(a) {
    const { count } = await supabase.from('evaluaciones').select('id', { count: 'exact', head: true }).eq('alumno_id', a.id)
    const notas = count ? ` y sus ${count} notas` : ''
    if (!window.confirm(`¿Borrar a ${a.apellidos_nombre}${notas}? No se puede deshacer.`)) return
    const { error } = await supabase.from('alumnos').delete().eq('id', a.id)
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    setMsg({ error: '', aviso: `${a.apellidos_nombre} borrado.` })
    cargar()
  }

  async function renombrar(e) {
    e.preventDefault()
    const nombre = editando.nombre.trim().replace(/\s+/g, ' ')
    if (!nombre) return
    const { error } = await supabase.from('alumnos').update({ apellidos_nombre: nombre }).eq('id', editando.id)
    if (error) { setMsg({ error: mensajeError(error), aviso: '' }); return }
    setEditando(null)
    cargar()
  }

  const activos = alumnos.filter((a) => a.activo)
  const bajas = alumnos.filter((a) => !a.activo)
  const lista = verBajas ? bajas : activos

  return (
    <>
      <header className="cabecera">
        <p className="suave">{grupo.nombre} · {grupo.curso}</p>
        <h1 className="titulo">Alumnos</h1>
        <p className="suave">{activos.length} en el grupo{bajas.length ? ` · ${bajas.length} de baja` : ''}</p>
      </header>

      <main className="pila">
        {msg.error && <p className="error" role="alert">{msg.error}</p>}
        {msg.aviso && <p className="aviso" role="status">{msg.aviso}</p>}

        {bajas.length > 0 && (
          <div className="segmentos" role="group" aria-label="Mostrar">
            <button aria-pressed={!verBajas} onClick={() => setVerBajas(false)}>En el grupo</button>
            <button aria-pressed={verBajas} onClick={() => setVerBajas(true)}>De baja</button>
          </div>
        )}

        <ul className="lista-simple">
          {lista.map((a) => (
            <li key={a.id} className="tarjeta fila-alumno">
              {editando?.id === a.id ? (
                <form className="fila-nuevo" onSubmit={renombrar}>
                  <label className="sr" htmlFor={`ren-${a.id}`}>Nombre</label>
                  <input id={`ren-${a.id}`} autoFocus value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
                  <button className="boton primario pequeno">Guardar</button>
                  <button type="button" className="boton pequeno" onClick={() => setEditando(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <span>{a.apellidos_nombre}</span>
                  <span className="acciones">
                    <button className="boton pequeno" onClick={() => setEditando({ id: a.id, nombre: a.apellidos_nombre })}>Editar</button>
                    <button className="boton pequeno" onClick={() => cambiarActivo(a)}>{a.activo ? 'Dar de baja' : 'Reactivar'}</button>
                    {!a.activo && esAdmin && (
                      <button className="boton pequeno peligro-texto" onClick={() => borrar(a)} aria-label={`Borrar a ${a.apellidos_nombre}`}>Borrar</button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
          {lista.length === 0 && <p className="suave">{verBajas ? 'No hay alumnos de baja.' : 'Todavía no hay alumnos.'}</p>}
        </ul>

        <form className="tarjeta pila" onSubmit={anadir}>
          <label className="campo">
            <span>Añadir alumnos (uno por línea: «Apellidos, Nombre»)</span>
            <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Alonso García, Lucía\nBenítez Ruiz, Marcos'} />
          </label>
          <button className="boton primario">Añadir</button>
          <p className="suave pequeno">Dar de baja no borra sus notas: deja de salir en las sesiones nuevas.{esAdmin ? ' Para borrar a un alumno del todo (con sus notas), dale de baja y pulsa «Borrar» en la lista «De baja».' : ''}</p>
        </form>
      </main>
    </>
  )
}
