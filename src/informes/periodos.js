import { aISO, fechaCorta, finDeMes, hoyISO, mesDe, nombreMes, sumarMeses } from '../util'

// Periodos de los informes, como en la hoja de cálculo:
// mes actual / anterior, cada mes de sep a jun, trimestres (1T oct–dic, 2T ene–mar, 3T abr–jun), curso y fechas.

export const MESES_CURSO = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// año en que empieza el curso: de «2026-27» o, si no, por la fecha de hoy
export function anioCurso(curso) {
  const m = /^(\d{4})/.exec(curso ?? '')
  if (m) return Number(m[1])
  const d = new Date()
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
}

const mesISO = (a, m) => `${a}-${String(m).padStart(2, '0')}`

export function opcionesPeriodo(anio) {
  const meses = MESES_CURSO.map((m) => {
    const mes = mesISO(m >= 9 ? anio : anio + 1, m)
    return { id: 'm' + mes, texto: nombreMes(mes), corto: CORTO[m], desde: `${mes}-01`, hasta: finDeMes(mes) }
  })
  const trimestres = [
    { id: '1T', texto: '1.er trimestre (oct–dic)', corto: '1T', desde: `${anio}-10-01`, hasta: `${anio}-12-31` },
    { id: '2T', texto: '2.º trimestre (ene–mar)', corto: '2T', desde: `${anio + 1}-01-01`, hasta: `${anio + 1}-03-31` },
    { id: '3T', texto: '3.er trimestre (abr–jun)', corto: '3T', desde: `${anio + 1}-04-01`, hasta: `${anio + 1}-06-30` },
  ]
  const curso = { id: 'curso', texto: `Todo el curso ${anio}-${String((anio + 1) % 100).padStart(2, '0')}`, corto: 'Curso', desde: `${anio}-09-01`, hasta: `${anio + 1}-08-31` }
  return { meses, trimestres, curso }
}

// Devuelve { desde, hasta, texto } para un id de periodo
export function resolverPeriodo(id, anio, fechas = {}) {
  const hoy = hoyISO()
  if (id === 'mes') {
    const m = mesDe(hoy)
    return { desde: `${m}-01`, hasta: finDeMes(m), texto: nombreMes(m) }
  }
  if (id === 'mesant') {
    const m = sumarMeses(mesDe(hoy), -1)
    return { desde: `${m}-01`, hasta: finDeMes(m), texto: nombreMes(m) }
  }
  if (id === 'fechas') {
    const desde = fechas.desde || '2000-01-01'
    const hasta = fechas.hasta || '2100-12-31'
    const texto = fechas.desde && fechas.hasta ? `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`
      : fechas.desde ? `Desde el ${fechaCorta(desde)}` : fechas.hasta ? `Hasta el ${fechaCorta(hasta)}` : 'Todo el registro'
    return { desde, hasta, texto }
  }
  const o = opcionesPeriodo(anio)
  const p = [...o.meses, ...o.trimestres, o.curso].find((x) => x.id === id)
  if (!p) return resolverPeriodo('mes', anio)
  return { desde: p.desde, hasta: p.hasta, texto: id.startsWith('m') ? p.texto : `${p.texto} · del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}` }
}

// meses (AAAA-MM) que toca un periodo
export function mesesEntre(desde, hasta) {
  const out = []
  let m = mesDe(desde)
  const fin = mesDe(hasta)
  for (let i = 0; m <= fin && i < 36; i++) { out.push(m); m = sumarMeses(m, 1) }
  return out
}

export const hoy = () => aISO(new Date())
