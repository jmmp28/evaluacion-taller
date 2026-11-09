// ---- fechas (siempre en hora local, formato AAAA-MM-DD) ----
export function hoyISO() {
  return aISO(new Date())
}

export function aISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

export function sumarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  return aISO(new Date(a, m - 1, d + n))
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  const t = `${DIAS[f.getDay()]}, ${d} de ${MESES[m - 1]}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function fechaCorta(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// ---- colores de categoría: por su orden, como en la hoja de cálculo ----
const PALETA = [
  { fuerte: '#2F5D8C', claro: '#D6E4F5', texto: '#1E3A5F' }, // azul
  { fuerte: '#276749', claro: '#D3EEDC', texto: '#1F5135' }, // verde
  { fuerte: '#6D28D9', claro: '#E6DCFA', texto: '#4C1D95' }, // morado
  { fuerte: '#0E7490', claro: '#CFEBF2', texto: '#155E75' }, // turquesa
  { fuerte: '#B91C1C', claro: '#F6D5D5', texto: '#7F1D1D' }, // rojo
  { fuerte: '#A16207', claro: '#F8ECC4', texto: '#713F12' }, // ocre
  { fuerte: '#BE185D', claro: '#F8D7E6', texto: '#831843' }, // rosa
  { fuerte: '#3730A3', claro: '#DDDFF8', texto: '#312E81' }, // añil
  { fuerte: '#7C4A1E', claro: '#EBDCCB', texto: '#5B3714' }, // marrón
  { fuerte: '#4D7C0F', claro: '#E3F0CC', texto: '#365314' }, // oliva
]

// categorias: lista ordenada (orden, nombre). Devuelve los colores de una categoría.
export function colorCategoria(categorias, categoriaId) {
  const i = categorias.findIndex((c) => c.id === categoriaId)
  if (i < 0) return { fuerte: '#4B5563', claro: '#E6E8EB', texto: '#3A4250' }
  return PALETA[i % PALETA.length]
}

// ---- notas ----
export const VALORES_NOTA = ['0', '1', '2', '3', 'A']

export const COLOR_NOTA = {
  '3': '#276749', '2': '#4D7C0F', '1': '#B45309', '0': '#B91C1C', A: '#4B5563',
}

// valor de una evaluación guardada: '0'..'3', 'A' o null
export function valorDe(ev) {
  if (!ev) return null
  if (ev.ausente) return 'A'
  return ev.nota === null || ev.nota === undefined ? null : String(ev.nota)
}

export function mensajeError(e) {
  if (!e) return ''
  const m = e.message || String(e)
  if (m.includes('row-level security')) return 'No tienes permiso para hacer eso.'
  if (m.includes('Failed to fetch')) return 'Sin conexión. Inténtalo de nuevo.'
  return m
}

// ---- meses (formato AAAA-MM) ----
export const mesDe = (iso) => iso.slice(0, 7)

export function sumarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function finDeMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return aISO(new Date(a, m, 0))
}

export function nombreMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  const t = `${MESES[m - 1]} ${a}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}
