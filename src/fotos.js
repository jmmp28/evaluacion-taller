import { supabase } from './supabase'

// Fotos de los proyectos. Cada foto se guarda dos veces en el bucket privado:
//   <grupo>/<nombre>.jpg      grande (lado mayor 1600 px) para ver e imprimir
//   <grupo>/<nombre>_min.jpg  miniatura (400 px) para las listas: gasta pocos datos
// Se reducen en el propio móvil antes de subirlas y salen ya derechas.

export const BUCKET = 'evaluacion-fotos'
export const CAMPOS_FOTO = 'id, proyecto_id, fecha, descripcion, ruta, ancho, alto, creado'
const GRANDE = 1600
const MINI = 400

export const rutaMini = (ruta) => ruta.replace(/\.jpg$/, '_min.jpg')

// Abre la imagen respetando la orientación de la cámara (EXIF)
async function abrirImagen(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { img: b, w: b.width, h: b.height, fin: () => b.close?.() }
    } catch { /* se prueba de la otra forma */ }
  }
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('No se puede leer esta imagen. Si es HEIC (iPhone), hazla con la cámara desde aquí o pásala a JPG.')
  }
  return { img, w: img.naturalWidth, h: img.naturalHeight, fin: () => URL.revokeObjectURL(url) }
}

function lienzo(im, max, giro) {
  const k = Math.min(1, max / Math.max(im.w, im.h))
  const w = Math.round(im.w * k)
  const h = Math.round(im.h * k)
  const tumbada = giro % 180 !== 0
  const c = document.createElement('canvas')
  c.width = tumbada ? h : w
  c.height = tumbada ? w : h
  const x = c.getContext('2d')
  x.fillStyle = '#fff'
  x.fillRect(0, 0, c.width, c.height)
  x.translate(c.width / 2, c.height / 2)
  x.rotate((giro * Math.PI) / 180)
  x.drawImage(im.img, -w / 2, -h / 2, w, h)
  return c
}

const aJPEG = (c, calidad) => new Promise((ok, mal) =>
  c.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido preparar la foto.'))), 'image/jpeg', calidad))

async function preparar(blob, giro = 0) {
  const im = await abrirImagen(blob)
  try {
    const g = lienzo(im, GRANDE, giro)
    const m = lienzo(im, MINI, giro)
    return { grande: await aJPEG(g, 0.82), mini: await aJPEG(m, 0.75), ancho: g.width, alto: g.height }
  } finally {
    im.fin()
  }
}

async function subirArchivo(ruta, blob) {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, await blob.arrayBuffer(), { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
  if (error) throw error
}

const nombreNuevo = (grupoId, proyectoId, fecha) =>
  `${grupoId}/${proyectoId}_${fecha}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`

async function subirPar(ruta, p) {
  await subirArchivo(ruta, p.grande)
  try {
    await subirArchivo(rutaMini(ruta), p.mini)
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([ruta])
    throw e
  }
}

// Sube una foto (archivo de la cámara o de la galería) y crea su fila
export async function subirFoto({ grupoId, proyectoId, fecha, archivo }) {
  const p = await preparar(archivo)
  const ruta = nombreNuevo(grupoId, proyectoId, fecha)
  await subirPar(ruta, p)
  const { data, error } = await supabase.from('fotos')
    .insert({ grupo_id: grupoId, proyecto_id: proyectoId, fecha, ruta, ancho: p.ancho, alto: p.alto })
    .select(CAMPOS_FOTO).single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta, rutaMini(ruta)])
    throw error
  }
  return data
}

// Gira 90° a la derecha. Se guarda con otro nombre para que nadie vea la versión vieja.
export async function girarFoto(foto, grupoId) {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(foto.ruta)
  if (error) throw error
  const p = await preparar(blob, 90)
  const ruta = nombreNuevo(grupoId, foto.proyecto_id, foto.fecha)
  await subirPar(ruta, p)
  const { data, error: e2 } = await supabase.from('fotos')
    .update({ ruta, ancho: p.ancho, alto: p.alto }).eq('id', foto.id).select(CAMPOS_FOTO).single()
  if (e2) {
    await supabase.storage.from(BUCKET).remove([ruta, rutaMini(ruta)])
    throw e2
  }
  await supabase.storage.from(BUCKET).remove([foto.ruta, rutaMini(foto.ruta)])
  return data
}

export async function borrarFoto(foto) {
  const { error } = await supabase.from('fotos').delete().eq('id', foto.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([foto.ruta, rutaMini(foto.ruta)])
}

// Enlaces temporales (1 hora) para ver fotos del bucket privado: ruta → url
export async function enlaces(rutas) {
  if (rutas.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600)
  if (error) throw error
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

// Sube varias seguidas, avisando del avance
export async function subirVarias(archivos, datos, alAvanzar) {
  const hechas = []
  const fallos = []
  for (let i = 0; i < archivos.length; i++) {
    alAvanzar?.(i + 1, archivos.length)
    try {
      hechas.push(await subirFoto({ ...datos, archivo: archivos[i] }))
    } catch (e) {
      fallos.push(`${archivos[i].name || 'foto ' + (i + 1)}: ${e.message || e}`)
    }
  }
  return { hechas, fallos }
}
