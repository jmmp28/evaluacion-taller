import { useState } from 'react'
import { useApp } from '../contexto'
import { mensajeError, fechaCorta } from '../util'
import CabeceraInforme from '../componentes/CabeceraInforme'
import { leerOds } from '../importar/leerOds'
import { importar } from '../importar/importar'

// Sólo administradores: pasar a la web los datos de la hoja de Calc (.ods)
export default function Importar() {
  const { grupo, grupos, setGrupoId, esAdmin } = useApp()
  const [datos, setDatos] = useState(null)
  const [nombre, setNombre] = useState('')
  const [estado, setEstado] = useState('')       // texto del paso en curso
  const [error, setError] = useState('')
  const [res, setRes] = useState(null)

  if (!esAdmin) return <main className="pila"><p className="aviso">Sólo un administrador puede importar datos.</p></main>

  async function elegir(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setDatos(null); setRes(null); setError(''); setNombre(f.name); setEstado('Leyendo el archivo…')
    try { setDatos(await leerOds(f)) } catch (err) { setError(mensajeError(err)) }
    setEstado('')
  }

  async function empezar() {
    setError(''); setRes(null)
    try { setRes(await importar(datos, grupo.id, setEstado)) } catch (err) { setError(mensajeError(err)); setEstado('') }
  }

  const fechas = datos?.registro.map((r) => r.fecha).sort() ?? []
  const dias = new Set(fechas).size
  const ocupado = !!estado

  return (
    <>
      <CabeceraInforme titulo="Importar de Calc" imprimir={false} volverA="/ajustes" />
      <main className="pila">
        <section className="tarjeta pila">
          <p className="suave pequeno">Elige el archivo <strong>Evaluacion_diaria.ods</strong>. Se lee aquí mismo, en el navegador, y no se modifica. Se puede importar más de una vez: lo que ya está en la web no se repite.</p>
          <label className="boton primario ancho">
            {nombre ? 'Elegir otro archivo' : 'Elegir el archivo .ods'}
            <input type="file" accept=".ods,application/vnd.oasis.opendocument.spreadsheet" hidden onChange={elegir} disabled={ocupado} data-prueba="ods" />
          </label>
          {nombre && <p className="suave pequeno">Archivo: {nombre}</p>}
        </section>

        {error && <p className="error" role="alert">{error}</p>}
        {estado && <p className="aviso" role="status">{estado}</p>}

        {datos && !res && (
          <section className="tarjeta pila" aria-label="Lo que se va a importar">
            <h2 className="subtitulo">Esto es lo que hay en el archivo</h2>
            <ul className="lista-resumen">
              <li><strong>{datos.alumnos.length}</strong> alumnos{datos.alumnos.some((a) => !a.activo) ? ` (${datos.alumnos.filter((a) => !a.activo).length} ya no están en la hoja «Alumnos»: entran de baja)` : ''}</li>
              <li><strong>{datos.actividades.length}</strong> tareas de {new Set(datos.actividades.map((a) => a.proy)).size} proyectos y {new Set(datos.actividades.map((a) => a.cat)).size} categorías</li>
              <li><strong>{datos.registro.length}</strong> notas en {dias} días{fechas.length ? ` (del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])})` : ''}</li>
              <li><strong>{datos.prevision.length}</strong> filas de previsión</li>
              <li><strong>{datos.fotos.length}</strong> fotos</li>
              <li><strong>{datos.observaciones.length}</strong> observaciones de la lista</li>
            </ul>
            {datos.avisos.map((a) => <p key={a} className="suave pequeno">⚠ {a}</p>)}
            <p className="suave pequeno">Las categorías y los proyectos se pasan a MAYÚSCULAS, como en la web (así «Trabajos en MADERA» y «TRABAJOS EN MADERA» quedan como uno solo).</p>
            {grupos.length > 1 ? (
              <label className="campo"><span>Importar en el grupo</span>
                <select value={grupo.id} onChange={(e) => setGrupoId(Number(e.target.value))} disabled={ocupado}>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.curso}</option>)}
                </select>
              </label>
            ) : <p className="pequeno">Se importa en el grupo <strong>{grupo.nombre}</strong>.</p>}
            <button className="boton primario" onClick={empezar} disabled={ocupado}>{ocupado ? 'Importando…' : 'Importar'}</button>
            <p className="suave pequeno">Las fotos tardan un poco: no cierres esta pantalla hasta que termine.</p>
          </section>
        )}

        {res && (
          <section className="tarjeta pila" aria-label="Resultado">
            <h2 className="subtitulo">Importación terminada</h2>
            <ul className="lista-resumen">
              <li>Alumnos nuevos: <strong>{res.alumnos}</strong></li>
              <li>Categorías, proyectos y tareas nuevos: <strong>{res.categorias}</strong> · <strong>{res.proyectos}</strong> · <strong>{res.tareas}</strong></li>
              <li>Sesiones nuevas: <strong>{res.sesiones}</strong></li>
              <li>Notas nuevas: <strong>{res.notas}</strong> de {res.notasTotal}{res.notas < res.notasTotal ? ' (las demás ya estaban)' : ''}</li>
              <li>Previsión nueva: <strong>{res.prevision}</strong> filas</li>
              <li>Fotos nuevas: <strong>{res.fotos}</strong></li>
            </ul>
            {res.fallosFotos.length > 0 && <p className="error">No se han podido subir {res.fallosFotos.length} fotos: {res.fallosFotos.join(' · ')}. Vuelve a importar para reintentarlo.</p>}
          </section>
        )}
      </main>
    </>
  )
}
