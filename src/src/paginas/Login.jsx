import { useState } from 'react'
import { supabase } from '../supabase'
import { mensajeError } from '../util'

export default function Login() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [estado, setEstado] = useState({ enviando: false, error: '', aviso: '' })

  async function entrar(e) {
    e.preventDefault()
    setEstado({ enviando: true, error: '', aviso: '' })
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setEstado({
      enviando: false, aviso: '',
      error: error ? (error.message.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : mensajeError(error)) : '',
    })
  }

  async function olvidada() {
    if (!email.trim()) { setEstado({ ...estado, error: 'Escribe primero tu correo.' }); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-clave`,
    })
    setEstado({ enviando: false, error: error ? mensajeError(error) : '',
      aviso: error ? '' : 'Te hemos enviado un correo para crear una contraseña nueva.' })
  }

  return (
    <main className="pantalla-centro">
      <form className="tarjeta acceso" onSubmit={entrar}>
        <h1 className="titulo">Evaluación del taller</h1>
        <p className="suave">Entra con la misma cuenta del Inventario.</p>
        <label className="campo">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {estado.error && <p className="error" role="alert">{estado.error}</p>}
        {estado.aviso && <p className="aviso" role="status">{estado.aviso}</p>}
        <button className="boton primario" disabled={estado.enviando}>{estado.enviando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="boton enlace" onClick={olvidada}>He olvidado la contraseña</button>
      </form>
    </main>
  )
}
