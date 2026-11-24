// Cadastro e manutenção de usuários (tela "Usuário e Permissões").
// Só Desenvolvedor e Diretoria acessam. A senha nunca é devolvida, e usuário não é
// apagado: ele é desativado (assim o histórico não se perde e dá para reativar).
import { Router } from 'express'

import obterClienteAuth from '../config/supabaseAuth.js'
import { gerarHash, CARGOS, CARGOS_ADMIN, exigirAdmin, limparCacheSituacao } from '../auth.js'

const router = Router()

router.use('/usuarios', exigirAdmin)

const COLUNAS_PUBLICAS = 'id, nome, email, cargo, ativo, created_at'
const REGEX_EMAIL = /^[^\s@,()"]+@[^\s@,()"]+\.[^\s@,()"]+$/
const REGEX_TELEFONE = /^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/

const ehAdmin = (cargo) => CARGOS_ADMIN.includes(cargo)

function mascararTelefone(digitos) {
  const numero = digitos.slice(2)
  const corte = numero.length > 8 ? 5 : 4
  return `(${digitos.slice(0, 2)}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

// Confere os dados enviados pela tela. Devolve { erro } ou { dados }.
function validar(corpo, { criando }) {
  const nome = String(corpo?.nome ?? '').trim()
  const email = String(corpo?.email ?? '').trim().toLowerCase()
  const cargo = String(corpo?.cargo ?? '')
  const senha = String(corpo?.senha ?? '')

  if (!nome) return { erro: 'Informe o nome do usuário.' }
  if (nome.length > 150) return { erro: 'O nome pode ter no máximo 150 caracteres.' }
  if (!REGEX_EMAIL.test(email) || email.length > 254) return { erro: 'Informe um e-mail válido.' }
  if (!CARGOS.includes(cargo)) return { erro: 'Selecione um cargo válido.' }

  if (criando && !senha) return { erro: 'Informe a senha.' }
  if (senha && (senha.length < 8 || senha.length > 200)) return { erro: 'A senha precisa ter entre 8 e 200 caracteres.' }

  const dados = { nome, email, cargo, senha }

  if (cargo === 'professor') {
    const digitos = String(corpo?.telefone ?? '').replace(/\D/g, '')
    const especialidade = String(corpo?.especialidade ?? '').trim()

    if (!REGEX_TELEFONE.test(digitos)) return { erro: 'Informe um telefone válido com DDD (10 ou 11 dígitos).' }
    if (!especialidade) return { erro: 'Informe a especialidade do professor.' }
    if (especialidade.length > 150) return { erro: 'A especialidade pode ter no máximo 150 caracteres.' }

    dados.telefone = mascararTelefone(digitos)
    dados.especialidade = especialidade
  }

  return { dados }
}

function lerId(valor) {
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 ? id : null
}

const erroDeBanco = (res, erro, mensagem) => {
  console.error(mensagem, '-', erro?.message || erro)
  return res.status(500).json({ error: mensagem })
}

// Garante que sempre sobre pelo menos um administrador ativo (e que ninguém se tranque para fora).
async function violaProtecao({ alvo, novoCargo, novoAtivo, req }) {
  if (alvo.id === req.usuario.sub && novoAtivo === false) {
    return 'Você não pode desativar a sua própria conta.'
  }

  const eraAdminAtivo = alvo.ativo && ehAdmin(alvo.cargo)
  const continuaAdminAtivo = novoAtivo && ehAdmin(novoCargo)

  if (eraAdminAtivo && !continuaAdminAtivo) {
    const { data, error } = await obterClienteAuth()
      .from('usuarios')
      .select('id')
      .eq('ativo', true)
      .in('cargo', CARGOS_ADMIN)
      .neq('id', alvo.id)

    if (error) throw error
    if (!data || data.length === 0) {
      return 'Precisa existir pelo menos um administrador ativo (Desenvolvedor ou Diretoria).'
    }
  }

  return null
}

// =========================
// PROFESSOR (tabela professores)
// =========================
async function salvarProfessor({ emailAntigo, nome, email, telefone, especialidade, ativo }) {
  const db = obterClienteAuth()
  const emails = [...new Set([emailAntigo, email].filter(Boolean))]

  const { data: achados, error } = await db.from('professores').select('id, email').in('email', emails)
  if (error) throw error

  const existente = achados.find((p) => p.email === emailAntigo) || achados.find((p) => p.email === email)
  const campos = { nome, email, telefone, especialidade, status: ativo ? 'ATIVO' : 'INATIVO' }

  const { error: erroSalvar } = existente
    ? await db.from('professores').update(campos).eq('id', existente.id)
    : await db.from('professores').insert(campos)

  if (erroSalvar) throw erroSalvar
}

async function definirStatusProfessor(email, ativo) {
  const { error } = await obterClienteAuth()
    .from('professores')
    .update({ status: ativo ? 'ATIVO' : 'INATIVO' })
    .eq('email', email)

  if (error) throw error
}

// =========================
// GET /usuarios
// =========================
router.get('/usuarios', async (req, res) => {
  const db = obterClienteAuth()

  const { data, error } = await db.from('usuarios').select(COLUNAS_PUBLICAS).order('nome', { ascending: true })
  if (error) return erroDeBanco(res, error, 'Não foi possível listar os usuários.')

  // Telefone e especialidade dos professores ficam na tabela professores.
  const emailsProfessores = data.filter((u) => u.cargo === 'professor').map((u) => u.email)
  const extras = new Map()

  if (emailsProfessores.length) {
    const { data: professores, error: erroProf } = await db
      .from('professores')
      .select('email, telefone, especialidade')
      .in('email', emailsProfessores)

    if (erroProf) console.error('Não consegui ler os professores:', erroProf.message)
    else professores.forEach((p) => extras.set(p.email, p))
  }

  res.json(data.map((u) => ({
    ...u,
    telefone: extras.get(u.email)?.telefone ?? '',
    especialidade: extras.get(u.email)?.especialidade ?? ''
  })))
})

// =========================
// POST /usuarios
// =========================
router.post('/usuarios', async (req, res) => {
  const { erro, dados } = validar(req.body, { criando: true })
  if (erro) return res.status(400).json({ error: erro })

  const db = obterClienteAuth()

  const { data: existente, error: erroBusca } = await db.from('usuarios').select('id').eq('email', dados.email).maybeSingle()
  if (erroBusca) return erroDeBanco(res, erroBusca, 'Não foi possível verificar o e-mail.')
  if (existente) return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' })

  const { data: criado, error: erroCriar } = await db
    .from('usuarios')
    .insert({ nome: dados.nome, email: dados.email, cargo: dados.cargo, senha_hash: await gerarHash(dados.senha), ativo: true })
    .select(COLUNAS_PUBLICAS)
    .single()

  if (erroCriar) {
    if (erroCriar.code === '23505') return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' })
    return erroDeBanco(res, erroCriar, 'Não foi possível cadastrar o usuário.')
  }

  if (dados.cargo === 'professor') {
    try {
      await salvarProfessor({ nome: dados.nome, email: dados.email, telefone: dados.telefone, especialidade: dados.especialidade, ativo: true })
    } catch (erroProf) {
      // Desfaz o usuário para não ficar um cadastro pela metade.
      await db.from('usuarios').delete().eq('id', criado.id)
      return erroDeBanco(res, erroProf, 'Não foi possível salvar os dados do professor na tabela professores. O usuário não foi cadastrado.')
    }
  }

  res.status(201).json({ ...criado, telefone: dados.telefone ?? '', especialidade: dados.especialidade ?? '' })
})

// =========================
// PUT /usuarios/:id  (editar)
// =========================
router.put('/usuarios/:id', async (req, res) => {
  const id = lerId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Usuário inválido.' })

  const { erro, dados } = validar(req.body, { criando: false })
  if (erro) return res.status(400).json({ error: erro })

  const db = obterClienteAuth()

  const { data: alvo, error: erroAlvo } = await db.from('usuarios').select(COLUNAS_PUBLICAS).eq('id', id).maybeSingle()
  if (erroAlvo) return erroDeBanco(res, erroAlvo, 'Não foi possível buscar o usuário.')
  if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' })

  try {
    const bloqueio = await violaProtecao({ alvo, novoCargo: dados.cargo, novoAtivo: alvo.ativo, req })
    if (bloqueio) return res.status(400).json({ error: bloqueio })
  } catch (erroProtecao) {
    return erroDeBanco(res, erroProtecao, 'Não foi possível validar a alteração.')
  }

  if (dados.email !== alvo.email) {
    const { data: outro, error: erroEmail } = await db.from('usuarios').select('id').eq('email', dados.email).neq('id', id).maybeSingle()
    if (erroEmail) return erroDeBanco(res, erroEmail, 'Não foi possível verificar o e-mail.')
    if (outro) return res.status(409).json({ error: 'Já existe outro usuário com este e-mail.' })
  }

  const campos = { nome: dados.nome, email: dados.email, cargo: dados.cargo }
  if (dados.senha) campos.senha_hash = await gerarHash(dados.senha)

  const { data: atualizado, error: erroAtualizar } = await db.from('usuarios').update(campos).eq('id', id).select(COLUNAS_PUBLICAS).single()

  if (erroAtualizar) {
    if (erroAtualizar.code === '23505') return res.status(409).json({ error: 'Já existe outro usuário com este e-mail.' })
    return erroDeBanco(res, erroAtualizar, 'Não foi possível salvar as alterações.')
  }

  limparCacheSituacao(id)

  try {
    if (dados.cargo === 'professor') {
      await salvarProfessor({ emailAntigo: alvo.email, nome: dados.nome, email: dados.email, telefone: dados.telefone, especialidade: dados.especialidade, ativo: atualizado.ativo })
    } else if (alvo.cargo === 'professor') {
      await definirStatusProfessor(alvo.email, false)   // deixou de ser professor
    }
  } catch (erroProf) {
    return erroDeBanco(res, erroProf, 'O usuário foi salvo, mas não consegui atualizar os dados na tabela professores.')
  }

  res.json({ ...atualizado, telefone: dados.telefone ?? '', especialidade: dados.especialidade ?? '' })
})

// =========================
// PATCH /usuarios/:id/ativo  (desativar / reativar)
// =========================
router.patch('/usuarios/:id/ativo', async (req, res) => {
  const id = lerId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Usuário inválido.' })
  if (typeof req.body?.ativo !== 'boolean') return res.status(400).json({ error: 'Informe se o usuário deve ficar ativo ou inativo.' })

  const db = obterClienteAuth()

  const { data: alvo, error: erroAlvo } = await db.from('usuarios').select(COLUNAS_PUBLICAS).eq('id', id).maybeSingle()
  if (erroAlvo) return erroDeBanco(res, erroAlvo, 'Não foi possível buscar o usuário.')
  if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' })

  try {
    const bloqueio = await violaProtecao({ alvo, novoCargo: alvo.cargo, novoAtivo: req.body.ativo, req })
    if (bloqueio) return res.status(400).json({ error: bloqueio })
  } catch (erroProtecao) {
    return erroDeBanco(res, erroProtecao, 'Não foi possível validar a alteração.')
  }

  const { data: atualizado, error: erroAtualizar } = await db.from('usuarios').update({ ativo: req.body.ativo }).eq('id', id).select(COLUNAS_PUBLICAS).single()
  if (erroAtualizar) return erroDeBanco(res, erroAtualizar, 'Não foi possível alterar a situação do usuário.')

  limparCacheSituacao(id)

  try {
    if (alvo.cargo === 'professor') await definirStatusProfessor(alvo.email, req.body.ativo)
  } catch (erroProf) {
    return erroDeBanco(res, erroProf, 'O usuário foi alterado, mas não consegui atualizar o status na tabela professores.')
  }

  res.json(atualizado)
})

export default router
