import { useEffect } from 'react'
import { IcoCerrar } from './Iconos'

// Panel que sube desde abajo (para elegir actividad u observación)
export default function Hoja({ titulo, onCerrar, children, pie }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onCerrar])
  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <section className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="hoja-cab">
          <h2>{titulo}</h2>
          <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><IcoCerrar /></button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
        {pie && <footer className="hoja-pie">{pie}</footer>}
      </section>
    </div>
  )
}
