import { useState } from 'react'

// Periodo elegido en un informe; se recuerda mientras la app esté abierta
export function usePeriodo(clave, defecto = 'mes') {
  const [valor, setValor] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('periodo-' + clave)) ?? { id: defecto } } catch { return { id: defecto } }
  })
  const cambiar = (v) => { setValor(v); sessionStorage.setItem('periodo-' + clave, JSON.stringify(v)) }
  return [valor, cambiar]
}
