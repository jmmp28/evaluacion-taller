import { useEffect, useState } from 'react'
import Hoja from './Hoja'
import { IcoAdelante, IcoAtras, IcoGirar } from './Iconos'
import { borrarFoto, enlaces, girarFoto } from '../fotos'
import { supabase } from '../supabase'
import { mensajeError } from '../util'

// Foto en grande: fecha, pie de foto, girar, borrar y pasar a la siguiente
export default function VisorFoto({ fotos, inicial, titulo, grupoId, onCambio, onBorrada, onCerrar }) {
  const [i, setI] = useState(inicial)
  const foto = fotos[Math.min(i, fotos.length - 1)]
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState(foto?.descripcion ?? '')
  const [fecha, setFecha] = useState(foto?.fecha ?? '')
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!foto) return
    setDesc(foto.descripcion ?? ''); setFecha(foto.fecha); setError(''); setUrl('')
    let vivo = true
    enlaces([foto.ruta]).then((m) => { if (vivo) setUrl(m[foto.ruta] ?? '') })
      .catch((e) => vivo && setError(mensajeError(e)))
    return () => { vivo = false }
  }, [foto?.id, foto?.ruta]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!foto) return null

  async function guardar(cambios) {
    const { data, error: e } = await supabase.from('fotos').update(cambios).eq('id', foto.id)
      .select('id, proyecto_id, fecha, descripcion, ruta, ancho, alto, creado').single()
    if (e) { setError(mensajeError(e)); return }
    onCambio(data)
  }

  async function girar() {
    setOcupado('Girando…'); setError('')
    try { onCambio(await girarFoto(foto, grupoId)) } catch (e) { setError(mensajeError(e)) }
    setOcupado('')
  }

  async function borrar() {
    if (!window.confirm('¿Borrar esta foto? No se puede deshacer.')) return
    setOcupado('Borrando…'); setError('')
    try {
      await borrarFoto(foto)
      onBorrada(foto.id)
      if (fotos.length <= 1) onCerrar()
      else setI((n) => Math.min(n, fotos.length - 2))
    } catch (e) { setError(mensajeError(e)) }
    setOcupado('')
  }

  const pie = (
    <div className="visor-acciones">
      <button className="boton pequeno" onClick={girar} disabled={!!ocupado}><IcoGirar /> Girar</button>
      <button className="boton pequeno peligro-texto" onClick={borrar} disabled={!!ocupado}>Borrar</button>
      {ocupado && <span className="suave pequeno" role="status">{ocupado}</span>}
    </div>
  )

  return (
    <Hoja titulo={`${titulo} · ${i + 1} de ${fotos.length}`} onCerrar={onCerrar} pie={pie}>
      <div className="visor">
        {fotos.length > 1 && (
          <button className="boton-icono visor-ant" aria-label="Foto anterior" onClick={() => setI((i - 1 + fotos.length) % fotos.length)}><IcoAtras /></button>
        )}
        {url
          ? <img src={url} alt={foto.descripcion || `Foto de ${titulo}`} style={{ aspectRatio: foto.ancho && foto.alto ? `${foto.ancho} / ${foto.alto}` : undefined }} />
          : <div className="visor-hueco" style={{ aspectRatio: foto.ancho && foto.alto ? `${foto.ancho} / ${foto.alto}` : '4 / 3' }}>Cargando…</div>}
        {fotos.length > 1 && (
          <button className="boton-icono visor-sig" aria-label="Foto siguiente" onClick={() => setI((i + 1) % fotos.length)}><IcoAdelante /></button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="dos-columnas">
        <label className="campo"><span>Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            onBlur={() => fecha && fecha !== foto.fecha && guardar({ fecha })} />
        </label>
        <span />
      </div>
      <label className="campo"><span>Pie de foto (opcional)</span>
        <input value={desc} placeholder="Qué se ve en la foto" onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc.trim() !== (foto.descripcion ?? '') && guardar({ descripcion: desc.trim() || null })} />
      </label>
    </Hoja>
  )
}
