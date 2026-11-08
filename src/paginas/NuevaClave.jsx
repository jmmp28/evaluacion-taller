import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { mensajeError } from '../util'

// Se llega aquí desde el correo de «He olvidado la contraseña»
export default function NuevaClave() {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(false)
  const ir = useNavigate()

  async function guardar(e) {
    e.preventDefault()
    if (clave.length < 8) { setError('Usa al menos 8 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) setError(mensajeError(error))
    else { setHecho(true); setTimeout(() => ir('/'), 1200) }
  }

  return (
    <main className="pantalla-centro">
      <form className="tarjeta acceso" onSubmit={guardar}>
        <h1 className="titulo">Contraseña nueva</h1>
        <label className="campo">
          <span>Nueva contraseña</span>
          <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {hecho && <p className="aviso" role="status">Guardada. Entrando…</p>}
        <button className="boton primario">Guardar</button>
      </form>
    </main>
  )
}
