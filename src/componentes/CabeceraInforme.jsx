import { useNavigate } from 'react-router-dom'
import { IcoAtras } from './Iconos'

// Cabecera de las pantallas de informe: volver, título y botón de imprimir
export default function CabeceraInforme({ titulo, imprimir = true, volverA = '/informes', listo = true }) {
  const ir = useNavigate()
  return (
    <header className="cabecera con-atras no-imprimir">
      <button className="boton-icono" onClick={() => ir(volverA)} aria-label="Volver"><IcoAtras /></button>
      <h1 className="titulo flex1">{titulo}</h1>
      {imprimir && <button className="boton pequeno" disabled={!listo} onClick={() => window.print()}>Imprimir / PDF</button>}
    </header>
  )
}
