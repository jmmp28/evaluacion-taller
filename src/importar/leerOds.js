import JSZip from 'jszip'

// Lee el archivo .ods de la hoja «Evaluación diaria» en el propio navegador
// y devuelve sus datos listos para importar. No modifica el archivo.

const NS = {
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
}

function textoCelda(celda) {
  const ps = celda.getElementsByTagNameNS(NS.text, 'p')
  const partes = []
  for (const p of ps) {
    let t = ''
    const recorrer = (n) => {
      for (const h of n.childNodes) {
        if (h.nodeType === 3) t += h.nodeValue
        else if (h.localName === 's') t += ' '.repeat(Number(h.getAttributeNS(NS.text, 'c') || 1))
        else if (h.localName === 'tab') t += '\t'
        else if (h.localName === 'line-break') t += '\n'
        else if (h.localName !== 'annotation') recorrer(h)
      }
    }
    recorrer(p)
    partes.push(t)
  }
  return partes.join('\n')
}

function valorCelda(celda) {
  const tipo = celda.getAttributeNS(NS.office, 'value-type')
  if (tipo === 'date') return (celda.getAttributeNS(NS.office, 'date-value') || '').slice(0, 10)
  if (tipo === 'float' || tipo === 'percentage' || tipo === 'currency') return Number(celda.getAttributeNS(NS.office, 'value'))
  if (tipo === 'boolean') return celda.getAttributeNS(NS.office, 'boolean-value') === 'true'
  const t = textoCelda(celda)
  return t === '' ? null : t
}

// Tabla → matriz de valores (las filas y columnas vacías repetidas del final se ignoran)
function leerTabla(tabla) {
  const filas = []
  for (const fila of tabla.getElementsByTagNameNS(NS.table, 'table-row')) {
    const repF = Number(fila.getAttributeNS(NS.table, 'number-rows-repeated') || 1)
    const valores = []
    for (const celda of fila.children) {
      if (celda.localName !== 'table-cell' && celda.localName !== 'covered-table-cell') continue
      const repC = Number(celda.getAttributeNS(NS.table, 'number-columns-repeated') || 1)
      const v = valorCelda(celda)
      if (v === null && repC > 50) { valores.push(null); continue }
      for (let i = 0; i < repC; i++) valores.push(v)
    }
    while (valores.length && valores[valores.length - 1] === null) valores.pop()
    const n = valores.length === 0 && repF > 50 ? 1 : Math.min(repF, 5000)
    for (let i = 0; i < n; i++) filas.push(valores)
  }
  while (filas.length && filas[filas.length - 1].length === 0) filas.pop()
  return filas
}

const limpio = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim())
const MAYUS = (v) => limpio(v).toLocaleUpperCase('es')
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// columna cuya cabecera empieza por alguno de los textos dados
function columna(cab, ...nombres) {
  const c = cab.map((x) => sinAcentos(limpio(x)))
  for (const n of nombres) {
    const i = c.findIndex((x) => x.startsWith(sinAcentos(n)))
    if (i >= 0) return i
  }
  return -1
}

const MESES = { sep: 9, oct: 10, nov: 11, dic: 12, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8 }

export async function leerOds(archivo) {
  const zip = await JSZip.loadAsync(archivo)
  const xml = await zip.file('content.xml')?.async('string')
  if (!xml) throw new Error('Este archivo no parece un .ods de LibreOffice.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const tablas = {}
  for (const t of doc.getElementsByTagNameNS(NS.table, 'table')) tablas[t.getAttributeNS(NS.table, 'name')] = t
  const hoja = (n) => (tablas[n] ? leerTabla(tablas[n]) : null)
  const avisos = []

  const reg = hoja('Registro')
  const alu = hoja('Alumnos')
  if (!reg || !alu) throw new Error('No encuentro las hojas «Registro» y «Alumnos». ¿Es el archivo de la evaluación diaria?')

  // ---- alumnos (los de la hoja; los que sólo están en el registro, de baja)
  const alumnos = []
  const vistos = new Set()
  for (const f of alu.slice(1)) {
    const n = limpio(f[0])
    if (n && !vistos.has(n.toLowerCase())) { vistos.add(n.toLowerCase()); alumnos.push({ nombre: n, activo: true }) }
  }

  // ---- registro
  const cab = reg[0] ?? []
  const C = {
    fecha: columna(cab, 'Fecha'), alumno: columna(cab, 'Alumno'), sesion: columna(cab, 'Sesi'),
    cat: columna(cab, 'Categor'), proy: columna(cab, 'Proyecto'), tarea: columna(cab, 'Tarea', 'Actividad'),
    detalle: columna(cab, 'Detalle'), nota: columna(cab, 'Nota'), asist: columna(cab, 'Asistencia'), obs: columna(cab, 'Observ'),
  }
  if (C.fecha < 0 || C.alumno < 0 || C.nota < 0) throw new Error('La hoja «Registro» no tiene las columnas esperadas (Fecha, Alumno, Nota…).')
  const registro = []
  let sinFecha = 0
  for (const f of reg.slice(1)) {
    const fecha = typeof f[C.fecha] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f[C.fecha]) ? f[C.fecha] : null
    const alumno = limpio(f[C.alumno])
    if (!fecha || !alumno) { if (alumno || fecha) sinFecha++; continue }
    const notaTxt = limpio(f[C.nota]).toUpperCase()
    const ausente = limpio(f[C.asist]).toLowerCase().startsWith('ausen') || notaTxt === 'A'
    const nota = ausente ? null : notaTxt === '' ? null : Number(notaTxt.replace(',', '.'))
    if (!ausente && (nota === null || !(nota >= 0 && nota <= 3))) continue
    if (!vistos.has(alumno.toLowerCase())) { vistos.add(alumno.toLowerCase()); alumnos.push({ nombre: alumno, activo: false }) }
    registro.push({
      fecha, alumno, sesion: Math.min(3, Math.max(1, Number(f[C.sesion]) || 1)),
      cat: C.cat >= 0 ? MAYUS(f[C.cat]) : '', proy: C.proy >= 0 ? MAYUS(f[C.proy]) : '', tarea: C.tarea >= 0 ? limpio(f[C.tarea]) : '',
      detalle: C.detalle >= 0 ? limpio(f[C.detalle]) : '', nota: ausente ? null : Math.round(nota), ausente,
      observacion: C.obs >= 0 ? limpio(f[C.obs]) : '',
    })
  }
  if (sinFecha) avisos.push(`${sinFecha} filas del registro sin fecha o sin alumno: no se importan.`)

  // ---- actividades (hoja Actividades + las que aparezcan en el registro y la previsión)
  const actividades = new Map()
  const anadirAct = (cat, proy, tarea) => {
    if (!cat || !proy || !tarea) return
    const k = `${cat}\u0001${proy}\u0001${tarea.toLowerCase()}`
    if (!actividades.has(k)) actividades.set(k, { cat, proy, tarea })
  }
  for (const f of (hoja('Actividades') ?? []).slice(1)) anadirAct(MAYUS(f[0]), MAYUS(f[1]), limpio(f[2]))
  for (const r of registro) anadirAct(r.cat, r.proy, r.tarea)

  // ---- listas: observaciones, observación fija por nota, año del curso
  const lis = hoja('Listas') ?? []
  const cabL = lis[0] ?? []
  const observaciones = []
  for (const f of lis.slice(1)) { const o = limpio(f[0]); if (o && !observaciones.includes(o)) observaciones.push(o) }
  const autoNota = {}
  const cFija = columna(cabL, 'Observación fija', 'Observacion fija', 'Observación automática')
  const cNota = cabL.findIndex((x, i) => i < cFija && sinAcentos(limpio(x)) === 'nota')
  if (cFija >= 0 && cNota >= 0) {
    for (const f of lis.slice(1, 7)) {
      const n = limpio(f[cNota]).toUpperCase(), o = limpio(f[cFija])
      if (['0', '1', '2', '3', 'A'].includes(n) && o) autoNota[n] = o
    }
  }
  let curso = null
  const cCurso = columna(cabL, 'Curso (a')
  if (cCurso >= 0 && Number(lis[1]?.[cCurso]) > 2000) curso = Number(lis[1][cCurso])
  if (!curso && registro.length) {
    const [a, m] = registro[0].fecha.split('-').map(Number)
    curso = m >= 9 ? a : a - 1
  }

  // ---- previsión
  const prevision = []
  const pv = hoja('Previsión') ?? hoja('Prevision') ?? []
  if (pv.length) {
    const c = pv[0]
    const P = { mes: columna(c, 'Mes'), proy: columna(c, 'Proyecto'), cat: columna(c, 'Categor'), tarea: columna(c, 'Tarea'), ses: columna(c, 'Sesiones'), notas: columna(c, 'Notas') }
    for (const f of pv.slice(1)) {
      const m = MESES[sinAcentos(limpio(f[P.mes])).slice(0, 3)]
      const proy = MAYUS(f[P.proy])
      if (!m || !proy || !curso) continue
      const anio = m >= 9 ? curso : curso + 1
      const cat = P.cat >= 0 ? MAYUS(f[P.cat]) : ''
      const tarea = P.tarea >= 0 ? limpio(f[P.tarea]) : ''
      let notas = P.notas >= 0 ? limpio(f[P.notas]) : ''
      if (/filas de ejemplo/i.test(notas)) notas = ''
      const ses = Number(f[P.ses])
      prevision.push({ mes: `${anio}-${String(m).padStart(2, '0')}-01`, proy, cat, tarea, sesiones: ses > 0 ? Math.round(ses) : null, notas })
      if (cat && tarea) anadirAct(cat, proy, tarea)
    }
  }

  // ---- fotos (las imágenes van dentro del .ods; cada una tiene su código en la hoja «Fotos»)
  const fotos = []
  if (tablas.Fotos) {
    const fo = leerTabla(tablas.Fotos)
    const iCab = fo.findIndex((f) => f.some((x) => sinAcentos(limpio(x)) === 'codigo'))
    const imagen = {}
    for (const fr of tablas.Fotos.getElementsByTagNameNS(NS.draw, 'frame')) {
      const img = fr.getElementsByTagNameNS(NS.draw, 'image')[0]
      const href = img?.getAttributeNS(NS.xlink, 'href')
      if (href) imagen[fr.getAttributeNS(NS.draw, 'name')] = href
    }
    if (iCab >= 0) {
      const c = fo[iCab]
      const F = { fecha: columna(c, 'Fecha'), proy: columna(c, 'Proyecto'), desc: columna(c, 'Descrip'), cod: columna(c, 'Codigo', 'Código') }
      for (const f of fo.slice(iCab + 1)) {
        const codigo = limpio(f[F.cod])
        const href = imagen[codigo]
        const proy = MAYUS(f[F.proy])
        if (!codigo || !proy) continue
        if (!href || !zip.file(href)) { avisos.push(`La foto ${codigo} (${proy}) no tiene imagen en el archivo.`); continue }
        fotos.push({ codigo, fecha: typeof f[F.fecha] === 'string' ? f[F.fecha].slice(0, 10) : null, proy, descripcion: limpio(f[F.desc]), href })
      }
    }
  }

  const imagen = (href) => zip.file(href).async('blob').then((b) => new Blob([b], { type: href.endsWith('.png') ? 'image/png' : 'image/jpeg' }))
  return { alumnos, registro, actividades: [...actividades.values()], observaciones, autoNota, prevision, fotos, curso, avisos, imagen }
}
