import { createClient } from '@supabase/supabase-js'

// Importa o supabase.js só para garantir que o .env já foi carregado.
import './supabase.js'

// Cliente usado pelo login e pelo cadastro de usuários.
// Se existir SUPABASE_SERVICE_KEY no .env ela é usada (recomendado, permite proteger a
// tabela usuarios). Senão, usa a SUPABASE_KEY de sempre.
let cliente

export default function obterClienteAuth() {
  if (!cliente) {
    cliente = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    )
  }
  return cliente
}
