// ============================================================================
// TESTE DO ASSISTENTE (AJUDA.JS) — rode depois de mexer em qualquer tela:
//
//     node testar-ajuda.mjs
//
// (na pasta SICEP, a mesma que tem as pastas "frontend" e "backend")
//
// Ele confere, sem abrir o navegador, se tudo que o assistente aponta ainda
// existe nas telas: ids, botões, textos, roteiros, janelas e páginas.
// Se algo falhar, mostra exatamente o que está fora de sincronia.
// Termina com código 1 quando há ERRO (serve para automatizar depois).
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const raiz = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.dirname(fileURLToPath(import.meta.url))

const dirHtml = path.join(raiz, 'frontend', 'HTML')
const dirJs   = path.join(raiz, 'frontend', 'JS')
const arqAjuda = path.join(dirJs, 'AJUDA.JS')

const erros = []
const avisos = []
const erro  = m => erros.push(m)
const aviso = m => avisos.push(m)

const ler = f => { try { return fs.readFileSync(f, 'utf8') } catch { return null } }

// ── 1. Lê o catálogo (a parte de dados do AJUDA.JS, sem abrir a interface) ──
const fonte = ler(arqAjuda)
if (!fonte) {
  console.error('Não achei ' + arqAjuda + '\nRode na pasta SICEP, ou passe o caminho: node testar-ajuda.mjs "C:\\caminho\\SICEP"')
  process.exit(2)
}

const ini = fonte.indexOf('const PAGINAS = {')
const fim = fonte.indexOf('// 3. UTILITÁRIOS')
if (ini < 0 || fim < 0) {
  console.error('Não consegui localizar o catálogo dentro do AJUDA.JS (os marcadores mudaram?).')
  process.exit(2)
}

let C
try {
  const trecho = fonte.slice(ini, fim).replace(/\/\/ ═+\s*$/, '')
  C = vm.runInNewContext(
    '"use strict";\n' + trecho +
    '\n;({ PAGINAS, LIMITACOES, ELEMENTOS, JANELAS, NOME_PAGINA, MENU_DA_PAGINA, ROTEIROS })',
    {}
  )
} catch (e) {
  console.error('O catálogo do AJUDA.JS tem erro de sintaxe: ' + e.message)
  process.exit(2)
}
const { PAGINAS, ELEMENTOS, JANELAS, NOME_PAGINA, MENU_DA_PAGINA, ROTEIROS } = C

// ── 2. Carrega as telas (HTML + os scripts que cada uma usa) ───────────────
const htmls = {}     // 'ALUNOS.HTML' -> texto do HTML
const corpusPagina = {}  // 'ALUNOS.HTML' -> HTML + JS dessa tela
const todos = []     // tudo junto (para itens do menu, que existem em todas as telas)

const arquivosHtml = fs.existsSync(dirHtml) ? fs.readdirSync(dirHtml).filter(f => /\.html$/i.test(f)) : []
for (const f of arquivosHtml) {
  const html = ler(path.join(dirHtml, f)) || ''
  htmls[f.toUpperCase()] = html
  let corpo = html
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    if (/^https?:/i.test(m[1])) continue
    const js = ler(path.resolve(dirHtml, m[1]))
    if (js == null) aviso(f + ': o script "' + m[1] + '" não foi encontrado.')
    else corpo += '\n' + js
  }
  corpusPagina[f.toUpperCase()] = corpo
  todos.push(corpo)
}
// scripts compartilhados (menu lateral, login etc.)
if (fs.existsSync(dirJs)) {
  for (const f of fs.readdirSync(dirJs)) if (/\.js$/i.test(f) && f.toUpperCase() !== 'AJUDA.JS') todos.push(ler(path.join(dirJs, f)) || '')
}
const corpusTodos = todos.join('\n')

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const temId = (id, texto) => new RegExp(
  `\\bid\\s*[=:]\\s*["'\`]${esc(id)}["'\`]|\\bid=["']?${esc(id)}\\b|setAttribute\\(\\s*["']id["']\\s*,\\s*["']${esc(id)}["']|\\.id\\s*=\\s*["'\`]${esc(id)}["'\`]`
).test(texto)

// ── 3. Cada elemento do catálogo existe na tela? ───────────────────────────
for (const [chave, def] of Object.entries(ELEMENTOS)) {
  const onde = def.pagina === '*' ? corpusTodos : corpusPagina[def.pagina]
  if (onde == null) { erro(chave + ': a tela ' + def.pagina + ' não foi encontrada na pasta frontend/HTML.'); continue }

  // A MARCA (data-ajuda="chave") na tela é o que o assistente usa primeiro.
  const marca = new RegExp(`data-ajuda\\s*=\\s*["']${esc(chave)}["']|dataset\\.ajuda\\s*=\\s*["']${esc(chave)}["']|["']${esc(chave)}["']\\s*\\)`)
  const temMarca = marca.test(onde)
  if (!temMarca) erro(chave + ': falta a marca data-ajuda="' + chave + '" em ' + def.pagina + ' (o assistente cai no seletor reserva).')

  const sel = def.seletor
  for (const m of sel.matchAll(/#([A-Za-z_][\w-]*)/g)) {
    if (!temId(m[1], onde)) (temMarca ? aviso : erro)(chave + ': o id "' + m[1] + '" (seletor reserva ' + sel + ') não existe em ' + def.pagina + '.')
  }
  for (const m of sel.matchAll(/\[(?:title|onclick|href|aria-label|data-[\w-]+)(?:="([^"]*)")?\]/g)) {
    const alvo = m[1]
    if (alvo !== undefined && !onde.includes(alvo)) (temMarca ? aviso : erro)(chave + ': o texto/atributo "' + alvo + '" (seletor reserva ' + sel + ') não aparece em ' + def.pagina + '.')
    if (alvo === undefined && !onde.includes(m[0].slice(1, -1))) erro(chave + ': o atributo ' + m[0] + ' não aparece em ' + def.pagina + '.')
  }
  for (const m of sel.matchAll(/(?:^|[\s>])\.([A-Za-z_][\w-]*)/g)) {
    if (!onde.includes(m[1])) erro(chave + ': a classe ".' + m[1] + '" (' + sel + ') não aparece em ' + def.pagina + '.')
  }
  if (def.contem && !onde.includes(def.contem)) (temMarca ? aviso : erro)(chave + ': o texto "' + def.contem + '" não aparece em ' + def.pagina + '.')

  if (def.navega) {
    if (!NOME_PAGINA[def.navega]) erro(chave + ': navega para "' + def.navega + '", que não está em NOME_PAGINA.')
    if (!htmls[def.navega]) erro(chave + ': navega para "' + def.navega + '", mas o arquivo não existe.')
  }
  for (const campo of ['janela', 'abre']) {
    if (def[campo] && !JANELAS[def[campo]]) erro(chave + ': ' + campo + ' = "' + def[campo] + '" não existe em JANELAS.')
  }
}

// ── 4. Janelas, menu e páginas ─────────────────────────────────────────────
for (const [nome, j] of Object.entries(JANELAS)) {
  if (!ELEMENTOS[j.teste]) erro('JANELAS.' + nome + ': "teste" aponta para "' + j.teste + '", que não existe em ELEMENTOS.')
  if (j.padrao && !ELEMENTOS[j.padrao]) erro('JANELAS.' + nome + ': "padrao" aponta para "' + j.padrao + '", que não existe em ELEMENTOS.')
  if (!j.padrao) aviso('JANELAS.' + nome + ': sem "padrao" (o guia não sabe abrir essa janela sozinho).')
}
for (const [pg, chave] of Object.entries(MENU_DA_PAGINA)) {
  if (!ELEMENTOS[chave]) erro('MENU_DA_PAGINA.' + pg + ': "' + chave + '" não existe em ELEMENTOS.')
  if (!NOME_PAGINA[pg]) erro('MENU_DA_PAGINA: "' + pg + '" não está em NOME_PAGINA.')
}
for (const pg of Object.keys(PAGINAS)) {
  if (!htmls[pg]) erro('PAGINAS: a tela "' + pg + '" não existe em frontend/HTML.')
}
for (const pg of Object.keys(htmls)) {
  if (/^(CURSOS_TURMAS|INDEX)\.HTML$/.test(pg)) continue
  if (!PAGINAS[pg]) aviso('A tela ' + pg + ' existe, mas o assistente não conhece (falta em PAGINAS).')
}

// ── 5. Roteiros ────────────────────────────────────────────────────────────
const usados = new Set()
const modos = new Set([undefined, 'click', 'manual'])

for (const [nome, r] of Object.entries(ROTEIROS)) {
  if (!r.titulo) erro('Roteiro ' + nome + ': sem título.')
  if (!r.descricao) erro('Roteiro ' + nome + ': sem descrição (a IA usa para escolher).')
  if (!Array.isArray(r.palavras) || !r.palavras.length) aviso('Roteiro ' + nome + ': sem palavras (o modo básico não vai achar).')
  if (!Array.isArray(r.passos) || !r.passos.length) { erro('Roteiro ' + nome + ': sem passos.'); continue }

  // Simula o planejador (completarPassos) para ver se o caminho fecha.
  let pagina = null
  let abertas = new Set()
  r.passos.forEach(([chave, texto, modo], i) => {
    const def = ELEMENTOS[chave]
    const rot = 'Roteiro ' + nome + ', passo ' + (i + 1)
    if (!def) { erro(rot + ': "' + chave + '" não existe em ELEMENTOS.'); return }
    usados.add(chave)
    if (!texto) erro(rot + ': sem texto de instrução.')
    if (!modos.has(modo)) aviso(rot + ': modo "' + modo + '" desconhecido.')

    if (pagina && def.pagina !== '*' && def.pagina !== pagina) { abertas = new Set() }
    if (def.pagina !== '*') pagina = def.pagina

    if (def.janela && !abertas.has(def.janela)) {
      const ponte = Object.entries(ELEMENTOS).find(([, d]) => d.abre === def.janela && d.janela && abertas.has(d.janela) && (d.pagina === '*' || d.pagina === pagina))
      const padrao = JANELAS[def.janela] && JANELAS[def.janela].padrao
      if (!ponte && !padrao) erro(rot + ' ("' + chave + '"): precisa da janela "' + def.janela + '" aberta, mas nenhum passo anterior abre e ela não tem "padrao".')
      abertas.add(def.janela)
    }
    if (def.abre) abertas.add(def.abre)
    if (def.fecha && def.janela) abertas.delete(def.janela)
    if (def.navega) { pagina = def.navega; abertas = new Set() }
  })
}
for (const chave of Object.keys(ELEMENTOS)) {
  if (!chave.startsWith('menu.') && !usados.has(chave)) {
    const usadoEmJanela = Object.values(JANELAS).some(j => j.teste === chave || j.padrao === chave)
    if (!usadoEmJanela) aviso('Elemento sem uso em nenhum roteiro: ' + chave)
  }
}

// ── 6. Tamanho do que vai para a IA (limite da cota da Groq) ───────────────
const linhasIA = Object.entries(ROTEIROS).map(([k, r]) => k + ' | ' + r.titulo + ' | ' + (r.descricao || ''))
const bytesIA = Buffer.byteLength(JSON.stringify({ r: linhasIA, p: PAGINAS, l: C.LIMITACOES }), 'utf8')
if (bytesIA > 14000) aviso('O catálogo enviado à IA está com ' + (bytesIA / 1024).toFixed(1) + ' KB. Acima de ~14 KB pode estourar o limite por minuto da Groq.')
if (Object.keys(ROTEIROS).length > 80) erro('Há mais de 80 roteiros; o backend só lê 80.')

// ── Resultado ──────────────────────────────────────────────────────────────
console.log('Pasta testada: ' + raiz)
console.log('Telas: ' + Object.keys(htmls).length + ' | Elementos: ' + Object.keys(ELEMENTOS).length + ' | Roteiros: ' + Object.keys(ROTEIROS).length + ' | Catálogo para a IA: ' + (bytesIA / 1024).toFixed(1) + ' KB\n')

if (avisos.length) { console.log('AVISOS (' + avisos.length + '):'); avisos.forEach(a => console.log('  - ' + a)); console.log('') }
if (erros.length)  { console.log('ERROS (' + erros.length + '):');  erros.forEach(e => console.log('  x ' + e)); console.log('\nO assistente está fora de sincronia com as telas. Corrija o AJUDA.JS (ou a tela) e rode de novo.'); process.exit(1) }
console.log('OK: tudo que o assistente aponta existe nas telas.')
