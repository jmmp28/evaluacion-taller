import { Link } from 'react-router-dom'
import { useApp } from '../contexto'
import { IcoAdelante } from '../componentes/Iconos'

const INFORMES = [
  { a: '/informes/resumen', t: 'Resumen de notas', d: 'Media, nota sobre 10 y asistencia de cada alumno; por trimestres y meses.' },
  { a: '/informes/alumnos', t: 'Informe por alumno', d: 'Trabajos de cada alumno (Proyecto → Categoría → Tarea) con un comentario redactado solo.' },
  { a: '/informes/trabajos', t: 'Trabajos del grupo', d: 'Qué se ha hecho, sin notas, frente a lo previsto. Con las fotos.' },
  { a: '/informes/proyectos', t: 'Proyectos en A4', d: 'Una página por proyecto: título, tareas y fotos. Para exponer.' },
  { a: '/prevision', t: 'Previsión', d: 'Qué teníais previsto hacer cada mes (para compararlo en «Trabajos del grupo»).' },
]

export default function Informes() {
  const { grupo } = useApp()
  return (
    <>
      <header className="cabecera">
        <p className="suave">{grupo.nombre} · {grupo.curso}</p>
        <h1 className="titulo">Informes</h1>
      </header>
      <main className="pila">
        {INFORMES.map((x) => (
          <Link key={x.a} to={x.a} className="tarjeta menu-informe">
            <span className="pila sin-relleno apretada">
              <strong>{x.t}</strong>
              <span className="suave pequeno">{x.d}</span>
            </span>
            <IcoAdelante />
          </Link>
        ))}
        <p className="suave pequeno">Todos se pueden imprimir o guardar en PDF con el botón «Imprimir / PDF». En el ordenador queda mejor; en el móvil, elige «Guardar como PDF» al imprimir.</p>
      </main>
    </>
  )
}
