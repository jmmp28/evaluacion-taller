import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function ProveedorApp({ children }) {
  const [sesion, setSesion] = useState(undefined)       // undefined = cargando
  const [profesor, setProfesor] = useState(undefined)
  const [grupos, setGrupos] = useState([])
  const [errorCarga, setErrorCarga] = useState('')
  const [grupoId, setGrupoIdState] = useState(() => Number(localStorage.getItem('grupo')) || null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarGrupos = useCallback(async () => {
    const { data } = await supabase.from('grupos').select('id, nombre, curso')
      .eq('activo', true).order('curso', { ascending: false }).order('nombre')
    setGrupos(data ?? [])
    return data ?? []
  }, [])

  useEffect(() => {
    if (sesion === undefined) return
    if (!sesion) { setProfesor(null); setGrupos([]); return }
    let vivo = true
    ;(async () => {
      setErrorCarga('')
      const { data, error } = await supabase.from('profesores').select('user_id, nombre, rol, activo')
        .eq('user_id', sesion.user.id).maybeSingle()
      if (!vivo) return
      if (error) { setErrorCarga(error.message || 'Sin conexión'); setProfesor(null); return }
      const p = data && data.activo ? data : null
      setProfesor(p)
      if (p) await cargarGrupos()
    })()
    return () => { vivo = false }
  }, [sesion, cargarGrupos])

  const setGrupoId = (id) => {
    setGrupoIdState(id)
    if (id) localStorage.setItem('grupo', String(id))
  }

  const grupo = grupos.find((g) => g.id === grupoId) ?? grupos[0] ?? null
  const cargando = sesion === undefined || (sesion && profesor === undefined)

  return (
    <Ctx.Provider value={{
      sesion, profesor, esAdmin: profesor?.rol === 'admin',
      grupos, grupo, setGrupoId, cargarGrupos, cargando, errorCarga,
      salir: () => supabase.auth.signOut(),
    }}>
      {children}
    </Ctx.Provider>
  )
}
