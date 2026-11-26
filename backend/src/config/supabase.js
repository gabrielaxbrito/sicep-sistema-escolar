import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Lê o .env que fica em backend/src/, de qualquer pasta que o servidor seja iniciado.
// (Antes só funcionava se o terminal estivesse dentro de backend/src.)
dotenv.config({ path: ['backend/src/.env', 'backend/.env', 'src/.env', '.env'] })
dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export default supabase