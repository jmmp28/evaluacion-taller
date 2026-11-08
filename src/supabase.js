import { createClient } from '@supabase/supabase-js'

// Se limpia la URL por si se pegó con algo detrás
// (p. ej. «https://xxxx.supabase.co/rest/v1/» → «https://xxxx.supabase.co»)
const url = (import.meta.env.VITE_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/(rest|auth|storage)\/v1.*$/, '')
  .replace(/\/+$/, '')
const clave = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!url || !clave) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example)')
}

// Todas las tablas de esta app están en el esquema «evaluacion» del mismo
// proyecto que el Inventario. El inicio de sesión es el mismo.
export const supabase = createClient(url, clave, {
  db: { schema: 'evaluacion' },
})
