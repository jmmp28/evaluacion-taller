import { NavLink } from 'react-router-dom'
import { IcoAjustes, IcoAlumnos, IcoFotos, IcoHoy } from './Iconos'

export default function BarraNav() {
  const cls = ({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')
  return (
    <nav className="barra-nav" aria-label="Secciones">
      <NavLink to="/" end className={cls}><IcoHoy />Hoy</NavLink>
      <NavLink to="/fotos" className={cls}><IcoFotos />Fotos</NavLink>
      <NavLink to="/alumnos" className={cls}><IcoAlumnos />Alumnos</NavLink>
      <NavLink to="/ajustes" className={cls}><IcoAjustes />Ajustes</NavLink>
    </nav>
  )
}
