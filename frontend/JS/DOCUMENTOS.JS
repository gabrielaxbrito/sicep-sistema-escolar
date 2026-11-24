const API = 'http://localhost:3000'

let tipoDeclaracao       = null
let alunoSelecionado     = null
let alunoSelecionadoCert = null
let tipoSolicitacao = 'certificado'
const documentos = {
  matricula: 'Comprovante de Matrícula',
  vinculo: 'Declaração de Vínculo Escolar',
  boletim: 'Boletim de Notas',
  historico: 'Histórico de Frequência',
  grade: 'Grade Horária Individual',
  modulo: 'Comprovante de Conclusão de Módulo'
}
const escaparHTML = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// BUSCA - FILTRO DOS CARDS

document.getElementById('buscaInput').addEventListener('input', function () {
  const termo = this.value.toLowerCase()
  document.querySelectorAll('.doc-card').forEach(card => {
    const nome = card.textContent.toLowerCase()
    card.style.display = nome.includes(termo) ? '' : 'none'
  })
})

// MODAL DECLARAÇÃO

function abrirModalDeclaracao(tipo) {
  tipoDeclaracao   = tipo
  alunoSelecionado = null

  // Atualiza título e label do campo conforme o tipo
  const porMatricula = ['frequencia', 'historico'].includes(tipo)
  const titulo = documentos[tipo] || (tipo === 'curso' ? 'Declaração de Curso' : 'Declaração de Frequência')
  const label = porMatricula ? 'ID da matrícula' : 'ID do aluno'
  const placeholder = `Digite o ${label}...`

  document.getElementById('modalDeclaracaoTitulo').textContent  = titulo
  document.getElementById('labelIdDeclaracao').textContent      = label
  document.getElementById('idDeclaracaoInput').placeholder      = placeholder
  document.getElementById('idDeclaracaoInput').value            = ''

  document.getElementById('erroIdDeclaracao').classList.add('hidden')
  document.getElementById('erroIdDeclaracao').textContent = 'Não encontrado. Verifique o ID e tente novamente.'
  document.getElementById('alunoSelecionadoBox').classList.add('hidden')
  document.getElementById('btnImprimir').disabled = true

  // Mostra campo de frequência só na declaração de frequência
  document.getElementById('campoFrequencia').classList.toggle('hidden', tipo !== 'frequencia')

  const modal = document.getElementById('modalDeclaracao')
  modal.classList.remove('hidden')
  modal.classList.add('flex')
}

function fecharModalDeclaracao() {
  tipoDeclaracao = null
  const modal = document.getElementById('modalDeclaracao')
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  alunoSelecionado = null
}

// BUSCAR (DECLARAÇÃO) — aluno ou matrícula conforme tipo

async function buscarDeclaracao() {
  const tipoBusca = tipoDeclaracao
  const id   = document.getElementById('idDeclaracaoInput').value.trim()
  const erro = document.getElementById('erroIdDeclaracao')
  const box  = document.getElementById('alunoSelecionadoBox')

  erro.classList.add('hidden')
  box.classList.add('hidden')
  document.getElementById('btnImprimir').disabled = true
  alunoSelecionado = null

  if (!id) return

  try {

    let nome    = ''
    let info    = ''
    let extra   = {}

    if (!['frequencia', 'historico'].includes(tipoBusca)) {

      // Busca pelo ID do aluno
      const res  = await fetch(`${API}/alunos/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Aluno não encontrado ou consulta indisponível. Verifique o ID e tente novamente.')
      const data = await res.json()

      const matriculaAtiva = (data.matriculas || []).find(m => m.status === 'ativa')
      nome  = data.nome
      info  = matriculaAtiva?.turmas?.cursos?.nome || 'Curso não informado'
      extra = { ...data }
      if (['matricula', 'vinculo'].includes(tipoBusca) && (!matriculaAtiva || !matriculaAtiva.turmas?.cursos?.nome || !data.nome)) {
        throw new Error('É necessário ter uma matrícula ativa com curso informado para emitir este documento.')
      }
      if (tipoBusca === 'boletim') throw new Error('As notas e os resultados acadêmicos ainda não estão disponíveis no sistema.')
      if (tipoBusca === 'modulo') throw new Error('O registro de conclusão de módulos ainda não está disponível no sistema.')
      if (tipoBusca === 'grade') throw new Error('A grade individual com dias, horários e disciplinas ainda não está disponível para emissão.')

    } else {

      // Busca pelo ID da matrícula e já calcula frequência
      const res  = await fetch(`${API}/matriculas/${encodeURIComponent(id)}/frequencia`)
      if (!res.ok) throw new Error('Matrícula não encontrada ou consulta indisponível. Verifique o ID e tente novamente.')
      const data = await res.json()
      if (tipoBusca === 'historico' && !data.total_aulas) throw new Error('Não há registros de frequência para esta matrícula.')

      nome  = data.nome
      info  = `${data.curso || 'Curso não informado'} — ${data.frequencia}% de frequência`
      extra = { ...data }

      // Preenche o campo de frequência automaticamente
      document.getElementById('frequenciaValor').value = data.frequencia

    }

    if (tipoBusca !== tipoDeclaracao || id !== document.getElementById('idDeclaracaoInput').value.trim()) return
    alunoSelecionado = extra

    document.getElementById('alunoSelecionadoNome').textContent = nome
    document.getElementById('alunoSelecionadoInfo').textContent = info
    box.classList.remove('hidden')
    document.getElementById('btnImprimir').disabled = false

  } catch (error) {
    if (tipoBusca !== tipoDeclaracao || id !== document.getElementById('idDeclaracaoInput').value.trim()) return
    erro.textContent = error.message && error.message !== 'Failed to fetch' ? error.message : 'Não foi possível consultar os dados. Verifique o ID e a conexão com o servidor.'
    erro.classList.remove('hidden')
    alunoSelecionado = null
  }
}

document.getElementById('idDeclaracaoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') buscarDeclaracao()
})
document.getElementById('idDeclaracaoInput').addEventListener('input', () => {
  alunoSelecionado = null
  document.getElementById('btnImprimir').disabled = true
  document.getElementById('alunoSelecionadoBox').classList.add('hidden')
})

// IMPRIMIR DECLARAÇÃO

function imprimirDeclaracao() {
  if (!alunoSelecionado) return

  const data       = alunoSelecionado
  const frequencia = document.getElementById('frequenciaValor')?.value || '___'

  let nomeAluno = ''
  let cursoNome = ''
  let titulo    = ''
  let conteudo  = ''

  if (['curso', 'matricula', 'vinculo'].includes(tipoDeclaracao)) {
    const matriculaAtiva = (data.matriculas || []).find(m => m.status === 'ativa')
    nomeAluno = escaparHTML(data.nome)
    cursoNome = escaparHTML(matriculaAtiva?.turmas?.cursos?.nome || '___________________________')
    titulo = (documentos[tipoDeclaracao] || 'Declaração de Curso').toUpperCase()
    conteudo  = `
      <p style="line-height: 2.2; text-align: justify;">
        Declaramos para os devidos fins que <strong>${nomeAluno}</strong>
        é aluno(a) regularmente matriculado(a) no curso de <strong>${cursoNome}</strong>,
        realizado na instituição <span style="display:inline-block; border-bottom: 1px solid #333; min-width: 200px;">&nbsp;</span>.
      </p>
      <p style="margin-top: 24px; line-height: 2; text-align: justify;">
        Por ser verdade, firmamos a presente declaração.
      </p>
    `
  } else {
    nomeAluno = escaparHTML(data.nome)
    cursoNome = escaparHTML(data.curso || '___________________________')
    titulo = (documentos[tipoDeclaracao] || 'Declaração de Frequência').toUpperCase()
    conteudo  = `
      <p style="line-height: 2.2; text-align: justify;">
        Declaramos para os devidos fins que <strong>${nomeAluno}</strong>,
        aluno(a) do curso de <strong>${cursoNome}</strong>,
        apresenta frequência geral de <strong>${frequencia}%</strong> nas atividades acadêmicas do referido curso.
      </p>
      <p style="margin-top: 24px; line-height: 2; text-align: justify;">
        Por ser verdade, firmamos a presente declaração.
      </p>
    `
    if (tipoDeclaracao === 'historico') {
      conteudo = `<p>Aluno(a): <strong>${nomeAluno}</strong></p><p>Curso: ${cursoNome}</p>
        <p>Disciplina: ${escaparHTML(data.disciplina || 'Não informada')}</p>
        <table style="width:100%;border-collapse:collapse" border="1" cellpadding="10">
          <tr><th>Aulas registradas</th><th>Presenças</th><th>Faltas</th><th>Frequência</th></tr>
          <tr><td>${Number(data.total_aulas)}</td><td>${Number(data.presentes)}</td><td>${Number(data.total_aulas) - Number(data.presentes)}</td><td>${Number(data.frequencia)}%</td></tr>
        </table>`
    }
  }

  const janela = window.open('', '_blank')
  if (!janela) {
    alert('Permita a abertura da janela de impressão para salvar o PDF.')
    return
  }
  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>${titulo}</title>
      <style>
        body { font-family: 'Times New Roman', serif; max-width: 700px; margin: 60px auto; padding: 40px; color: #111; font-size: 14px; }
        .cabecalho { border-bottom: 2px solid #07224f; padding-bottom: 20px; margin-bottom: 50px; }
        .cabecalho h1 { font-size: 18px; color: #07224f; margin: 0 0 4px; }
        .cabecalho p  { margin: 0; font-size: 12px; color: #555; }
        h2 { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
        .data { margin-top: 40px; font-size: 12px; color: #555; }
        .assinatura { margin-top: 80px; }
        .assinatura .linha { border-top: 1px solid #333; width: 250px; margin-bottom: 8px; }
        @media print { body { margin: 40px; } }
      </style>
    </head>
    <body>
      <div class="cabecalho">
        <h1>SICEP — Secretaria Acadêmica</h1>
        <p>Sistema Integrado de Controle de Ensino e Processos</p>
      </div>
      <h2>${titulo}</h2>
      ${conteudo}
      <p class="data">
        Emitido em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
      </p>
      <div class="assinatura">
        <div class="linha"></div>
        <p style="font-size:12px; color:#555;">Assinatura e carimbo do responsável</p>
      </div>
      <script>window.onload = () => { window.print() }<\/script>
    </body>
    </html>
  `)
  janela.document.close()
}

// MODAL CERTIFICAÇÃO

function abrirModalCertificacao(tipo = 'certificado') {
  tipoSolicitacao = tipo
  document.getElementById('tituloSolicitacao').textContent = tipo === 'trancamento' ? 'Declaração de Trancamento' : 'Certificado de Conclusão'
  document.getElementById('avisoSolicitacao').textContent = tipo === 'trancamento'
    ? 'Comprova a suspensão temporária da matrícula. A solicitação deve ser analisada pela secretaria antes da emissão. O envio pelo sistema ainda não está disponível.'
    : 'O certificado não pode ser emitido diretamente. É necessário registrar uma solicitação, que será verificada pelo setor responsável antes da emissão.'
  alunoSelecionadoCert = null
  document.getElementById('idAlunoCertInput').value = ''
  document.getElementById('obsCert').value          = ''
  document.getElementById('erroIdAlunoCert').classList.add('hidden')
  document.getElementById('alunoSelecionadoCertBox').classList.add('hidden')
  document.getElementById('erroCert').classList.add('hidden')
  document.getElementById('sucessoCert').classList.add('hidden')

  const modal = document.getElementById('modalCertificacao')
  modal.classList.remove('hidden')
  modal.classList.add('flex')
}

function fecharModalCertificacao() {
  const modal = document.getElementById('modalCertificacao')
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  alunoSelecionadoCert = null
}

// BUSCAR ALUNO POR ID (CERTIFICAÇÃO)

async function buscarAlunoPorIdCert() {
  const id   = document.getElementById('idAlunoCertInput').value.trim()
  const erro = document.getElementById('erroIdAlunoCert')
  const box  = document.getElementById('alunoSelecionadoCertBox')

  erro.classList.add('hidden')
  box.classList.add('hidden')

  if (!id) return

  try {
    const res  = await fetch(`${API}/alunos/${id}`)
    if (!res.ok) throw new Error()
    const data = await res.json()

    alunoSelecionadoCert = data

    const matriculaAtiva = (data.matriculas || []).find(m => m.status === 'ativa')
    const cursoNome = matriculaAtiva?.turmas?.cursos?.nome || 'Curso não informado'

    document.getElementById('alunoSelecionadoCertNome').textContent  = data.nome
    document.getElementById('alunoSelecionadoCertCurso').textContent = cursoNome
    box.classList.remove('hidden')

  } catch {
    erro.classList.remove('hidden')
    alunoSelecionadoCert = null
  }
}

document.getElementById('idAlunoCertInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') buscarAlunoPorIdCert()
})

// ENVIAR SOLICITAÇÃO DE CERTIFICAÇÃO

async function solicitarCertificacao() {
  const erro    = document.getElementById('erroCert')
  const sucesso = document.getElementById('sucessoCert')
  const btn     = document.getElementById('btnSolicitarCert')

  erro.classList.add('hidden')
  sucesso.classList.add('hidden')
  if (tipoSolicitacao === 'trancamento') {
    erro.textContent = 'O envio de solicitações ainda não está integrado ao sistema. Entre em contato com a secretaria para solicitar a Declaração de Trancamento.'
    erro.classList.remove('hidden')
    return
  }

  if (!alunoSelecionadoCert) {
    erro.textContent = 'Busque e selecione um aluno antes de continuar.'
    erro.classList.remove('hidden')
    return
  }

  btn.disabled = true
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'

  // Simulação — será conectado ao back-end depois
  await new Promise(r => setTimeout(r, 800))

  sucesso.classList.remove('hidden')
  btn.disabled = false
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar solicitação'

  setTimeout(() => fecharModalCertificacao(), 2000)
}

// MENU MOBILE

const menuBtn = document.getElementById('menuBtn')
const sidebar = document.getElementById('sidebar')
const overlay = document.getElementById('overlay')

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full')
    overlay.classList.toggle('hidden')
  })
  overlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full')
    overlay.classList.add('hidden')
  })
}
