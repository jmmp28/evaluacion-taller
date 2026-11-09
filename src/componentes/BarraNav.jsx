import { NavLink, useLocation } from 'react-router-dom'
import { IcoAjustes, IcoAlumnos, IcoFotos, IcoHoy, IcoInformes } from './Iconos'

export default function BarraNav() {
  const { pathname } = useLocation()
  const cls = ({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')
  return (
    <nav className="barra-nav no-imprimir" aria-label="Secciones">
      <NavLink to="/" end className={cls}><IcoHoy />Hoy</NavLink>
      <NavLink to="/fotos" className={cls}><IcoFotos />Fotos</NavLink>
      <NavLink to="/informes" className={({ isActive }) => cls({ isActive: isActive || pathname === '/prevision' })}><IcoInformes />Informes</NavLink>
      <NavLink to="/alumnos" className={cls}><IcoAlumnos />Alumnos</NavLink>
      <NavLink to="/ajustes" className={cls}><IcoAjustes />Ajustes</NavLink>
    </nav>
  )
}
