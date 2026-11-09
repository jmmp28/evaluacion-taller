import { useRef } from 'react'
import { IcoCamara, IcoGaleria } from './Iconos'

// Dos botones: hacer una foto con la cámara o elegir varias de la galería
export default function BotonesFoto({ onArchivos, desactivado, pequeno }) {
  const camara = useRef(null)
  const galeria = useRef(null)
  const elegir = (e) => {
    const lista = [...(e.target.files ?? [])]
    e.target.value = ''
    if (lista.length) onArchivos(lista)
  }
  const cls = 'boton' + (pequeno ? ' pequeno' : '')
  return (
    <span className="acciones">
      <button type="button" className={cls} disabled={desactivado} onClick={() => camara.current.click()}>
        <IcoCamara /> Cámara
      </button>
      <button type="button" className={cls} disabled={desactivado} onClick={() => galeria.current.click()}>
        <IcoGaleria /> Galería
      </button>
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={elegir} data-prueba="camara" />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={elegir} data-prueba="galeria" />
    </span>
  )
}
