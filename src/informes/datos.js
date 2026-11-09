import { supabase } from '../supabase'

// ---------------------------------------------------------------- lectura
// Filas de la vista «registro» (una por alumno y sesión) de un grupo y periodo
export async function cargarRegistro(grupoId, desde, hasta, alumnoId) {
  const filas = []
  for (let i = 0; ; i += 1000) {
    let q = supabase.from('registro')
      .select('fecha, alumno_id, alumno, sesion, categoria, proyecto, tarea, nota, asistencia, observacion')
      .eq('grupo_id', grupoId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha').order('sesion').order('alumno').range(i, i + 999)
    if (alumnoId) q = q.eq('alumno_id', alumnoId)
    const { data, error } = await q
    if (error) throw error
    filas.push(...data)
    if (data.length < 1000) break
  }
  return filas
}

// ---------------------------------------------------------------- cálculos
export const SIN_P = '(sin proyecto)'
export const SIN_C = '(sin categoría)'
export const SIN_T = '(sin tarea)'

// sesiones evaluadas, ausencias, % asistencia, media (0–3, ausente = 0), nota /10, puntos
export function cifras(filas) {
  const ev = filas.filter((f) => f.nota !== null && f.nota !== undefined)
  const ses = ev.length
  const aus = ev.filter((f) => f.asistencia === 'Ausente').length
  const puntos = ev.reduce((s, f) => s + Number(f.nota), 0)
  const media = ses ? puntos / ses : null
  return { ses, aus, asistencia: ses ? 1 - aus / ses : null, media, nota10: media === null ? null : (media / 3) * 10, puntos }
}

export const fmt1 = (x) => (x === null || x === undefined ? '' : (Math.round(x * 10) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
export const fmt2 = (x) => (x === null || x === undefined ? '' : x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const pct = (x) => (x === null || x === undefined ? '' : `${Math.round(x * 100)} %`)

// colores como en la hoja: media ≥ 2,25 verde · < 1,5 rojo · resto ámbar
export function claseMedia(media) {
  if (media === null || media === undefined) return ''
  if (media >= 2.25) return 'alto'
  if (media < 1.5) return 'bajo'
  return 'medio'
}

// Trabajos de un alumno agrupados por Proyecto → Categoría → Tarea, en orden de aparición
export function trabajosAlumno(filas) {
  const grupos = new Map()
  for (const f of filas) {
    const p = f.proyecto || SIN_P, c = f.categoria || SIN_C, t = f.tarea || SIN_T
    const k = `${p}\u0001${c}\u0001${t}`
    if (!grupos.has(k)) grupos.set(k, { proyecto: p, categoria: c, tarea: t, filas: [], d1: f.fecha, d2: f.fecha })
    const g = grupos.get(k)
    g.filas.push(f)
    if (f.fecha < g.d1) g.d1 = f.fecha
    if (f.fecha > g.d2) g.d2 = f.fecha
  }
  const lista = [...grupos.values()].map((g) => {
    const pres = g.filas.filter((f) => f.asistencia === 'Presente')
    return { ...g, ...cifras(g.filas), nPres: pres.length, mediaPres: pres.length ? pres.reduce((s, f) => s + Number(f.nota), 0) / pres.length : null }
  })
  return ordenarPorProyecto(lista)
}

// proyecto por su primera fecha, luego categoría por su primera fecha, luego tarea por fecha
function ordenarPorProyecto(lista) {
  const inicioP = {}, inicioC = {}
  for (const g of lista) {
    if (g.d1 && (!inicioP[g.proyecto] || g.d1 < inicioP[g.proyecto])) inicioP[g.proyecto] = g.d1
    const kc = g.proyecto + '\u0001' + g.categoria
    if (g.d1 && (!inicioC[kc] || g.d1 < inicioC[kc])) inicioC[kc] = g.d1
  }
  const z = '9999-12-31'
  return lista.sort((a, b) =>
    (inicioP[a.proyecto] ?? z).localeCompare(inicioP[b.proyecto] ?? z) || a.proyecto.localeCompare(b.proyecto, 'es') ||
    (inicioC[a.proyecto + '\u0001' + a.categoria] ?? z).localeCompare(inicioC[b.proyecto + '\u0001' + b.categoria] ?? z) ||
    a.categoria.localeCompare(b.categoria, 'es') ||
    (a.d1 ?? z).localeCompare(b.d1 ?? z) || a.tarea.localeCompare(b.tarea, 'es'))
}

// ---------------------------------------------------------------- comentario automático
export const NIVELES = [
  [2.5, '{nombre} ha realizado un trabajo excelente en este periodo.'],
  [2.0, '{nombre} ha realizado un buen trabajo en este periodo.'],
  [1.5, '{nombre} ha realizado un trabajo adecuado, aunque todavía puede mejorar.'],
  [1.0, '{nombre} ha tenido dificultades en este periodo y necesita mejorar su trabajo.'],
  [0.0, '{nombre} no ha alcanzado un nivel de trabajo suficiente en este periodo.'],
]

// «García López, Ana María» → «Ana María»
export function nombrePila(s) {
  const i = s.indexOf(',')
  return (i >= 0 ? s.slice(i + 1) : s).trim() || s
}

export function comentarioAlumno(nombre, filas, grupos) {
  const c = cifras(filas)
  if (!c.ses) return ''
  const nom = nombrePila(nombre)
  let s = (NIVELES.find(([min]) => c.media >= min - 0.0001) ?? NIVELES[NIVELES.length - 1])[1].replace('{nombre}', nom)

  // trabajo realizado
  const proyectos = [...new Set(grupos.map((g) => g.proyecto))]
  let lista = proyectos.slice(0, 4).map((p, k) => (k === 0 ? '' : k === Math.min(proyectos.length, 4) - 1 && proyectos.length <= 4 ? ' y ' : ', ') + p).join('')
  if (proyectos.length > 4) lista += '…'
  s += ` Ha trabajado en ${proyectos.length === 1 ? 'el proyecto ' : `${proyectos.length} proyectos (`}${lista}${proyectos.length === 1 ? '' : ')'}` +
    `, con ${grupos.length} ${grupos.length === 1 ? 'tarea' : 'tareas distintas'} a lo largo de ${c.ses} ${c.ses === 1 ? 'sesión.' : 'sesiones.'}`

  // dónde destaca y dónde le cuesta (sólo sesiones a las que asistió)
  const conPres = grupos.filter((g) => g.nPres > 0)
  if (conPres.length >= 2) {
    const mejor = conPres.reduce((a, b) => (b.mediaPres > a.mediaPres ? b : a))
    const peor = conPres.reduce((a, b) => (b.mediaPres < a.mediaPres ? b : a))
    s += mejor.mediaPres - peor.mediaPres >= 0.75
      ? ` Destaca en «${mejor.tarea}» (${mejor.proyecto}) y le ha costado más «${peor.tarea}» (${peor.proyecto}).`
      : ' Su rendimiento ha sido parecido en las distintas tareas.'
  }

  // evolución en el periodo
  const notasPres = filas.filter((f) => f.asistencia === 'Presente').map((f) => Number(f.nota))
  if (notasPres.length >= 4) {
    const m = Math.floor(notasPres.length / 2)
    const a = notasPres.slice(0, m).reduce((x, y) => x + y, 0) / m
    const b = notasPres.slice(-m).reduce((x, y) => x + y, 0) / m
    s += b - a >= 0.5 ? ' Ha mejorado a lo largo del periodo.'
      : a - b >= 0.5 ? ' Su rendimiento ha bajado en la última parte del periodo.'
        : ' Se ha mantenido constante durante el periodo.'
  }

  // asistencia
  if (c.aus === 0) s += ' Ha asistido a todas las sesiones.'
  else {
    const p = Math.round((1 - c.aus / c.ses) * 100)
    s += ` Ha faltado a ${c.aus} de ${c.ses} ${c.ses === 1 ? 'sesión' : 'sesiones'} (${p} % de asistencia)${p < 80 ? ', lo que ha influido en su resultado.' : '.'}`
  }

  // observación más repetida
  const veces = {}
  for (const f of filas) if (f.observacion) veces[f.observacion] = (veces[f.observacion] ?? 0) + 1
  const [obs, n] = Object.entries(veces).sort((x, y) => y[1] - x[1])[0] ?? []
  if (n >= 2) s += ` La observación más repetida ha sido «${obs}».`
  return s
}

// ---------------------------------------------------------------- trabajos del grupo frente a la previsión
// filas: registro del periodo · prevision: [{ proyecto, categoria, tarea, sesiones_previstas }]
export function trabajosGrupo(filas, prevision) {
  const grupos = new Map()
  const todasSes = new Set(), todosDias = new Set()
  for (const f of filas) {
    const p = f.proyecto || SIN_P, c = f.categoria || SIN_C, t = f.tarea || SIN_T
    const k = `${p}\u0001${c}\u0001${t}`.toUpperCase()
    if (!grupos.has(k)) grupos.set(k, { proyecto: p, categoria: c, tarea: t, ses: new Set(), dias: new Set(), pres: 0, d1: f.fecha, d2: f.fecha, previsto: -1 })
    const g = grupos.get(k)
    const ks = `${f.fecha}-${f.sesion}`
    g.ses.add(ks); todasSes.add(ks); g.dias.add(f.fecha); todosDias.add(f.fecha)
    if (f.asistencia === 'Presente') g.pres++
    if (f.fecha < g.d1) g.d1 = f.fecha
    if (f.fecha > g.d2) g.d2 = f.fecha
  }
  const reales = [...grupos.values()]
  const U = (x) => (x ?? '').toUpperCase()
  for (const pv of prevision) {
    if (!pv.proyecto) continue
    const n = pv.sesiones_previstas ?? 0
    const coinciden = reales.filter((g) => U(g.proyecto) === U(pv.proyecto) &&
      (!pv.categoria || U(g.categoria) === U(pv.categoria)) && (!pv.tarea || U(g.tarea) === U(pv.tarea)))
    if (coinciden.length) {
      for (const g of coinciden) {
        if (g.previsto < 0) g.previsto = 0
        if (pv.tarea) g.previsto += n
      }
    } else {
      const c = pv.categoria || '(cualquier categoría)', t = pv.tarea || '(cualquier tarea)'
      const k = `${pv.proyecto}\u0001${c}\u0001${t}`.toUpperCase()
      if (!grupos.has(k)) grupos.set(k, { proyecto: pv.proyecto, categoria: c, tarea: t, ses: new Set(), dias: new Set(), pres: 0, d1: null, d2: null, previsto: 0 })
      grupos.get(k).previsto += n
    }
  }
  const lista = ordenarPorProyecto([...grupos.values()].map((g) => ({
    ...g, nSes: g.ses.size, nDias: g.dias.size, alumnosSesion: g.ses.size ? g.pres / g.ses.size : null,
    estado: estadoTrabajo(g.ses.size, g.previsto),
  })))
  const cuenta = (e) => lista.filter((g) => g.estado.startsWith(e)).length
  return {
    lista, dias: todosDias.size, sesiones: todasSes.size,
    realizadas: cuenta('Realizada'), parciales: cuenta('Parcial'), pendientes: cuenta('Pendiente'), noPrevistas: cuenta('No prevista'),
  }
}

export function estadoTrabajo(nSes, previsto) {
  if (nSes > 0 && previsto >= 0) return previsto > 0 && nSes < previsto ? `Parcial (${nSes} de ${previsto})` : 'Realizada'
  if (nSes > 0) return 'No prevista'
  return 'Pendiente'
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
