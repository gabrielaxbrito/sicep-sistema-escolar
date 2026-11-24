// Funções de segurança do login: senha criptografada, token de sessão e bloqueio das rotas.
// Senha e token usam só o que já vem com o Node (módulo "crypto"), sem instalar nada novo.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import obterClienteAuth from './config/supabaseAuth.js'

const scrypt = promisify(crypto.scrypt)

// Quanto tempo a pessoa fica logada (depois disso precisa entrar de novo)
export const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60

// Cargos existentes e quais deles podem gerenciar usuários.
export const CARGOS = ['desenvolvedor', 'diretoria', 'gerente', 'coordenador', 'professor', 'assistente']
export const CARGOS_ADMIN = ['desenvolvedor', 'diretoria']

// =========================
// SEGREDO DO TOKEN
// =========================
// Usa JWT_SECRET do .env, se existir. Se não existir, cria um segredo aleatório
// na primeira vez e guarda no arquivo backend/src/.auth-secret (não apague, senão
// todo mundo precisa fazer login de novo).
let segredoEmCache

function obterSegredo() {
  if (segredoEmCache) return segredoEmCache

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    segredoEmCache = process.env.JWT_SECRET
    return segredoEmCache
  }

  const arquivo = fileURLToPath(new URL('./.auth-secret', import.meta.url))

  try {
    const salvo = fs.readFileSync(arquivo, 'utf8').trim()
    if (salvo.length >= 32) {
      segredoEmCache = salvo
      return segredoEmCache
    }
  } catch {
    // arquivo ainda não existe: vamos criar abaixo
  }

  const novo = crypto.randomBytes(48).toString('hex')
  try {
    fs.writeFileSync(arquivo, novo + '\n', { mode: 0o600 })
  } catch (erro) {
    console.warn('Aviso: não consegui salvar o segredo do login (' + erro.message + '). Os logins serão perdidos ao reiniciar o servidor.')
  }
  segredoEmCache = novo
  return segredoEmCache
}

// =========================
// SENHA (hash com salt)
// =========================
export async function gerarHash(senha) {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(senha, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function conferirSenha(senha, armazenado) {
  const partes = String(armazenado || '').split('$')
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false

  try {
    const salt = Buffer.from(partes[1], 'hex')
    const esperado = Buffer.from(partes[2], 'hex')
    const calculado = await scrypt(senha, salt, esperado.length)
    return crypto.timingSafeEqual(calculado, esperado)
  } catch {
    return false
  }
}

// Hash "de mentira" para gastar o mesmo tempo quando o e-mail não existe
// (assim ninguém descobre quais e-mails estão cadastrados pelo tempo da resposta).
let hashFalso
export async function obterHashFalso() {
  if (!hashFalso) hashFalso = await gerarHash('senha-falsa-' + crypto.randomBytes(8).toString('hex'))
  return hashFalso
}

// =========================
// TOKEN (formato JWT HS256)
// =========================
const base64url = (valor) => Buffer.from(valor).toString('base64url')

function assinar(conteudo) {
  return crypto.createHmac('sha256', obterSegredo()).update(conteudo).digest('base64url')
}

export function criarToken(usuario) {
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corpo = base64url(JSON.stringify({
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    cargo: usuario.cargo,
    iat: agora,
    exp: agora + DURACAO_SESSAO_SEGUNDOS
  }))
  return `${cabecalho}.${corpo}.${assinar(cabecalho + '.' + corpo)}`
}

// Devolve os dados da pessoa se o token for válido; senão devolve null.
export function lerToken(token) {
  const partes = String(token || '').split('.')
  if (partes.length !== 3) return null

  const [cabecalho, corpo, assinatura] = partes

  try {
    const esperada = Buffer.from(assinar(cabecalho + '.' + corpo))
    const recebida = Buffer.from(assinatura)
    if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null

    const cab = JSON.parse(Buffer.from(cabecalho, 'base64url').toString('utf8'))
    if (cab.alg !== 'HS256') return null

    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))
    if (!dados.exp || dados.exp < Math.floor(Date.now() / 1000)) return null

    return dados
  } catch {
    return null
  }
}

// =========================
// BLOQUEIO DAS ROTAS
// =========================
// A cada requisição conferimos no banco se a conta continua ativa e qual é o cargo atual
// (guardado por 15 segundos para não consultar toda hora). Assim, desativar um usuário
// ou mudar o cargo dele vale quase na hora, sem esperar a sessão vencer.
const VALIDADE_CACHE_MS = 15 * 1000
const situacaoEmCache = new Map()

export function limparCacheSituacao(id) {
  if (id === undefined || id === null) situacaoEmCache.clear()
  else situacaoEmCache.delete(Number(id))
}

async function situacaoDoUsuario(id) {
  const guardado = situacaoEmCache.get(Number(id))
  if (guardado && guardado.valido_ate > Date.now()) return guardado.dados

  const { data, error } = await obterClienteAuth()
    .from('usuarios')
    .select('id, nome, email, cargo, ativo')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const dados = data && data.ativo !== false ? data : null
  situacaoEmCache.set(Number(id), { dados, valido_ate: Date.now() + VALIDADE_CACHE_MS })
  return dados
}

// Tudo que vier depois deste middleware só funciona com login.
export async function exigirLogin(req, res, next) {
  // O navegador faz uma "pergunta prévia" (OPTIONS) sem token; deixa passar.
  if (req.method === 'OPTIONS') return next()

  const cabecalho = req.headers.authorization || ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
  const sessao = lerToken(token)

  if (!sessao) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' })
  }

  try {
    const atual = await situacaoDoUsuario(sessao.sub)

    if (!atual) {
      return res.status(401).json({ error: 'Sua conta foi desativada ou não existe mais.' })
    }

    // Usa nome/cargo atuais do banco (o token pode estar desatualizado).
    req.usuario = { ...sessao, nome: atual.nome, email: atual.email, cargo: atual.cargo }
    next()
  } catch (erro) {
    console.error('Erro ao validar a sessão:', erro.message)
    res.status(503).json({ error: 'Não foi possível validar sua sessão agora. Tente novamente.' })
  }
}

// Só Desenvolvedor e Diretoria passam.
export function exigirAdmin(req, res, next) {
  if (!CARGOS_ADMIN.includes(req.usuario?.cargo)) {
    return res.status(403).json({ error: 'Você não tem permissão para gerenciar usuários.' })
  }
  next()
}
