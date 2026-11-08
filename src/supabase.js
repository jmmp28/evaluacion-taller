import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !clave) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example)')
}

// Todas las tablas de esta app están en el esquema «evaluacion» del mismo
// proyecto que el Inventario. El inicio de sesión es el mismo.
export const supabase = createClient(url, clave, {
  db: { schema: 'evaluacion' },
})
