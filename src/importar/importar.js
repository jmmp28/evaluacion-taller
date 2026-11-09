import { supabase } from '../supabase'
import { subirFoto } from '../fotos'
import { hoyISO } from '../util'

// Pasa a la web lo leído del .ods. Se puede repetir: lo que ya existe se salta.

async function todas(consulta) {
  const out = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await consulta().range(i, i + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

async function enTrozos(lista, n, fn) {
  let total = 0
  for (let i = 0; i < lista.length; i += n) total += await fn(lista.slice(i, i + n))
  return total
}

const k3 = (a, b, c) => `${a}\u0001${b}\u0001${(c ?? '').toLowerCase()}`

export async function importar(datos, grupoId, avisar) {
  const res = {}
  const paso = (t) => avisar?.(t)

  // ---- observaciones y observación automática por nota
  paso('Observaciones…')
  if (datos.observaciones.length) {
    const { data, error } = await supabase.from('observaciones')
      .upsert(datos.observaciones.map((texto, i) => ({ texto, orden: i + 1 })), { onConflict: 'texto', ignoreDuplicates: true }).select('id')
    if (error) throw error
    res.observaciones = data.length
  }
  const auto = Object.entries(datos.autoNota).map(([nota, observacion]) => ({ nota, observacion }))
  if (auto.length) {
    const { error } = await supabase.from('observacion_por_nota').upsert(auto, { onConflict: 'nota' })
    if (error) throw error
  }

  // ---- catálogo: categorías, proyectos y tareas
  paso('Actividades…')
  const cats = await todas(() => supabase.from('categorias').select('id, nombre, orden').order('id'))
  const catId = Object.fromEntries(cats.map((c) => [c.nombre.toLocaleUpperCase('es'), c.id]))
  let orden = Math.max(0, ...cats.map((c) => c.orden ?? 0))
  const proyNombres = new Set([...datos.actividades.map((a) => a.proy), ...datos.prevision.map((p) => p.proy), ...datos.fotos.map((f) => f.proy)])
  const catNuevas = [...new Set([...datos.actividades.map((a) => a.cat), ...datos.prevision.map((p) => p.cat).filter(Boolean)])].filter((c) => !catId[c])
  if (catNuevas.length) {
    const { data, error } = await supabase.from('categorias').insert(catNuevas.map((nombre) => ({ nombre, orden: ++orden }))).select('id, nombre')
    if (error) throw error
    for (const c of data) catId[c.nombre] = c.id
  }
  res.categorias = catNuevas.length

  const proys = await todas(() => supabase.from('proyectos').select('id, nombre').order('id'))
  const proyId = Object.fromEntries(proys.map((p) => [p.nombre.toLocaleUpperCase('es'), p.id]))
  const proyNuevos = [...proyNombres].filter((p) => p && !proyId[p])
  if (proyNuevos.length) {
    const { data, error } = await supabase.from('proyectos').insert(proyNuevos.map((nombre) => ({ nombre }))).select('id, nombre')
    if (error) throw error
    for (const p of data) proyId[p.nombre] = p.id
  }
  res.proyectos = proyNuevos.length

  const tareas = await todas(() => supabase.from('tareas').select('id, nombre, categoria_id, proyecto_id').order('id'))
  const tareaId = Object.fromEntries(tareas.map((t) => [k3(t.categoria_id, t.proyecto_id, t.nombre), t.id]))
  const tNuevas = datos.actividades
    .map((a) => ({ categoria_id: catId[a.cat], proyecto_id: proyId[a.proy], nombre: a.tarea }))
    .filter((t) => t.categoria_id && t.proyecto_id && !tareaId[k3(t.categoria_id, t.proyecto_id, t.nombre)])
  const unicas = [...new Map(tNuevas.map((t) => [k3(t.categoria_id, t.proyecto_id, t.nombre), t])).values()]
  if (unicas.length) {
    const { data, error } = await supabase.from('tareas').insert(unicas).select('id, nombre, categoria_id, proyecto_id')
    if (error) throw error
    for (const t of data) tareaId[k3(t.categoria_id, t.proyecto_id, t.nombre)] = t.id
  }
  res.tareas = unicas.length
  const idTarea = (cat, proy, tarea) => (cat && proy && tarea ? tareaId[k3(catId[cat], proyId[proy], tarea)] ?? null : null)

  // ---- alumnos
  paso('Alumnos…')
  const alus = await todas(() => supabase.from('alumnos').select('id, apellidos_nombre').eq('grupo_id', grupoId).order('id'))
  const aluId = Object.fromEntries(alus.map((a) => [a.apellidos_nombre.toLowerCase(), a.id]))
  const aNuevos = datos.alumnos.filter((a) => !aluId[a.nombre.toLowerCase()])
  if (aNuevos.length) {
    const { data, error } = await supabase.from('alumnos')
      .insert(aNuevos.map((a) => ({ grupo_id: grupoId, apellidos_nombre: a.nombre, activo: a.activo }))).select('id, apellidos_nombre')
    if (error) throw error
    for (const a of data) aluId[a.apellidos_nombre.toLowerCase()] = a.id
  }
  res.alumnos = aNuevos.length

  // ---- sesiones (una por día y número, con la actividad de esa sesión)
  paso('Sesiones…')
  const porSesion = new Map()
  for (const r of datos.registro) {
    const k = `${r.fecha}#${r.sesion}`
    if (!porSesion.has(k)) porSesion.set(k, { fecha: r.fecha, numero: r.sesion, tarea_id: null, detalle: '' })
    const s = porSesion.get(k)
    if (!s.tarea_id) s.tarea_id = idTarea(r.cat, r.proy, r.tarea)
    if (!s.detalle && r.detalle) s.detalle = r.detalle
  }
  const sesiones = [...porSesion.values()].map((s) => ({ grupo_id: grupoId, fecha: s.fecha, numero: s.numero, tarea_id: s.tarea_id, detalle: s.detalle || null }))
  res.sesiones = await enTrozos(sesiones, 500, async (t) => {
    const { data, error } = await supabase.from('sesiones').upsert(t, { onConflict: 'grupo_id,fecha,numero', ignoreDuplicates: true }).select('id')
    if (error) throw error
    return data.length
  })
  const fechas = datos.registro.map((r) => r.fecha).sort()
  const sesId = {}
  if (fechas.length) {
    const ss = await todas(() => supabase.from('sesiones').select('id, fecha, numero').eq('grupo_id', grupoId)
      .gte('fecha', fechas[0]).lte('fecha', fechas[fechas.length - 1]).order('id'))
    for (const s of ss) sesId[`${s.fecha}#${s.numero}`] = s.id
  }

  // ---- notas
  paso('Notas…')
  const evs = datos.registro.map((r) => ({
    sesion_id: sesId[`${r.fecha}#${r.sesion}`], alumno_id: aluId[r.alumno.toLowerCase()],
    nota: r.ausente ? null : r.nota, ausente: r.ausente, observacion: r.observacion || null,
  })).filter((e) => e.sesion_id && e.alumno_id)
  const unicasEv = [...new Map(evs.map((e) => [`${e.sesion_id}#${e.alumno_id}`, e])).values()]
  res.notas = await enTrozos(unicasEv, 500, async (t) => {
    const { data, error } = await supabase.from('evaluaciones').upsert(t, { onConflict: 'sesion_id,alumno_id', ignoreDuplicates: true }).select('id')
    if (error) throw error
    return data.length
  })
  res.notasTotal = unicasEv.length

  // ---- previsión
  paso('Previsión…')
  const pvs = await todas(() => supabase.from('prevision').select('mes, proyecto_id, categoria_id, tarea_id').eq('grupo_id', grupoId).order('id'))
  const hay = new Set(pvs.map((p) => `${p.mes}|${p.proyecto_id}|${p.categoria_id ?? ''}|${p.tarea_id ?? ''}`))
  const pNuevas = []
  for (const p of datos.prevision) {
    const fila = {
      grupo_id: grupoId, mes: p.mes, proyecto_id: proyId[p.proy], categoria_id: p.cat ? catId[p.cat] ?? null : null,
      tarea_id: idTarea(p.cat, p.proy, p.tarea), sesiones_previstas: p.sesiones, notas: p.notas || null,
    }
    if (!fila.proyecto_id) continue
    const k = `${fila.mes}|${fila.proyecto_id}|${fila.categoria_id ?? ''}|${fila.tarea_id ?? ''}`
    if (hay.has(k)) continue
    hay.add(k); pNuevas.push(fila)
  }
  if (pNuevas.length) {
    const { error } = await supabase.from('prevision').insert(pNuevas)
    if (error) throw error
  }
  res.prevision = pNuevas.length

  // ---- fotos (cada una con un nombre fijo sacado de su código, para no repetirla)
  const ya = new Set((await todas(() => supabase.from('fotos').select('ruta').eq('grupo_id', grupoId).like('ruta', `${grupoId}/calc_%`).order('id'))).map((f) => f.ruta))
  res.fotos = 0
  res.fallosFotos = []
  const pendientes = datos.fotos.filter((f) => !ya.has(`${grupoId}/calc_${f.codigo.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`))
  for (let i = 0; i < pendientes.length; i++) {
    const f = pendientes[i]
    paso(`Fotos… ${i + 1} de ${pendientes.length}`)
    try {
      await subirFoto({
        grupoId, proyectoId: proyId[f.proy], fecha: f.fecha || hoyISO(), descripcion: f.descripcion,
        archivo: await datos.imagen(f.href), nombre: `calc_${f.codigo.replace(/[^A-Za-z0-9_-]/g, '_')}`,
      })
      res.fotos++
    } catch (e) {
      res.fallosFotos.push(`${f.proy} ${f.codigo}: ${e.message || e}`)
    }
  }
  paso('')
  return res
}
