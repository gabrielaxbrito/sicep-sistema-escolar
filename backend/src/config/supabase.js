import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Carrega backend/.env independentemente da pasta de inicializacao.
// (Antes só funcionava se o terminal estivesse dentro de backend/src.)
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })
dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export default supabase
