import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './contexto'
import BarraNav from './componentes/BarraNav'
import Login from './paginas/Login'
import NuevaClave from './paginas/NuevaClave'
import SinAcceso from './paginas/SinAcceso'
import Hoy from './paginas/Hoy'
import Sesion from './paginas/Sesion'
import Alumnos from './paginas/Alumnos'
import Fotos from './paginas/Fotos'
import Informes from './paginas/Informes'
import InfResumen from './paginas/InfResumen'
import InfAlumno from './paginas/InfAlumno'
import InfTrabajos from './paginas/InfTrabajos'
import InfProyectos from './paginas/InfProyectos'
import Prevision from './paginas/Prevision'
import Ajustes from './paginas/Ajustes'

export default function App() {
  const { sesion, profesor, grupo, esAdmin, cargando, errorCarga, salir } = useApp()

  if (cargando) return <div className="pantalla-centro"><p className="suave">Cargando…</p></div>

  if (!sesion) {
    return (
      <Routes>
        <Route path="/nueva-clave" element={<NuevaClave />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  if (errorCarga) {
    return (
      <main className="pantalla-centro">
        <div className="tarjeta acceso">
          <h1 className="titulo">No se ha podido conectar</h1>
          <p className="suave">Comprueba la conexión a internet e inténtalo de nuevo.</p>
          <button className="boton primario" onClick={() => window.location.reload()}>Reintentar</button>
          <button className="boton enlace" onClick={salir}>Cerrar sesión</button>
        </div>
      </main>
    )
  }
  if (!profesor) return <SinAcceso />

  // sin grupos: el admin va a Ajustes a crear uno; un profesor espera a que se lo asignen
  if (!grupo) {
    return esAdmin
      ? <div className="app"><Ajustes sinGrupos /></div>
      : <SinAcceso sinGrupo />
  }

  return (
    <div className="app">
      <div className="contenido">
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/sesion/:id" element={<Sesion />} />
          <Route path="/fotos" element={<Fotos />} />
          <Route path="/informes" element={<Informes />} />
          <Route path="/informes/resumen" element={<InfResumen />} />
          <Route path="/informes/alumnos" element={<InfAlumno />} />
          <Route path="/informes/trabajos" element={<InfTrabajos />} />
          <Route path="/informes/proyectos" element={<InfProyectos />} />
          <Route path="/prevision" element={<Prevision />} />
          <Route path="/alumnos" element={<Alumnos />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/nueva-clave" element={<NuevaClave />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BarraNav />
    </div>
  )
}
