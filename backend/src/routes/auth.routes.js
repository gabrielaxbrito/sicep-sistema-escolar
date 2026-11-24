import { Router } from 'express'
import obterClienteAuth from '../config/supabaseAuth.js'
import { conferirSenha, criarToken, obterHashFalso, exigirLogin, DURACAO_SESSAO_SEGUNDOS } from '../auth.js'

const router = Router()

// =========================
// LIMITE DE TENTATIVAS
// =========================
// 5 erros em 15 minutos para o mesmo e-mail + computador = bloqueio temporário.
const MAX_ERROS = 5
const JANELA_MS = 15 * 60 * 1000
const erros = new Map()

function chaveTentativa(req, email) {
  return `${req.ip}|${email}`
}

function estaBloqueado(chave) {
  const registro = erros.get(chave)
  if (!registro) return false
  if (Date.now() - registro.inicio > JANELA_MS) {
    erros.delete(chave)
    return false
  }
  return registro.total >= MAX_ERROS
}

function registrarErro(chave) {
  const agora = Date.now()
  const registro = erros.get(chave)
  if (!registro || agora - registro.inicio > JANELA_MS) {
    erros.set(chave, { total: 1, inicio: agora })
  } else {
    registro.total += 1
  }
}

// =========================
// POST /auth/login
// =========================
router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const senha = String(req.body?.senha ?? '')

  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe o e-mail e a senha.' })
  }

  if (email.length > 254 || senha.length > 200) {
    return res.status(400).json({ error: 'E-mail ou senha inválidos.' })
  }

  const chave = chaveTentativa(req, email)

  if (estaBloqueado(chave)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' })
  }

  const { data, error } = await obterClienteAuth()
    .from('usuarios')
    .select('id, nome, email, cargo, ativo, senha_hash')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('Erro ao consultar usuarios:', error.message)
    return res.status(500).json({
      error: 'Não foi possível consultar os usuários. Confira se a tabela "usuarios" foi criada no Supabase.'
    })
  }

  // Confere a senha mesmo quando o e-mail não existe (mesmo tempo de resposta).
  const senhaCorreta = await conferirSenha(senha, data?.senha_hash || await obterHashFalso())

  if (!data || !senhaCorreta || data.ativo === false) {
    registrarErro(chave)
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' })
  }

  erros.delete(chave)

  const usuario = { id: data.id, nome: data.nome, email: data.email, cargo: data.cargo }

  res.json({
    token: criarToken(usuario),
    expira_em: DURACAO_SESSAO_SEGUNDOS,
    usuario
  })
})

// =========================
// GET /auth/me  (quem está logado)
// =========================
router.get('/auth/me', exigirLogin, (req, res) => {
  const { sub, nome, email, cargo } = req.usuario
  res.json({ usuario: { id: sub, nome, email, cargo } })
})

export default router
