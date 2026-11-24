// Conecta o backend ao banco de dados Supabase.
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: [resolve('backend/.env'), resolve('.env'), resolve('../.env')], quiet: true })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
export default supabase
