
  const API = String(window.SICEP_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

  // ========================= ESTADO =========================

  let todosAlunos           = []
  let editandoId            = null
  let excluindoId           = null
  let matriculaAlunoIdAtual = null

  // ========================= ELEMENTOS =========================

  const modal          = document.getElementById('modal')
  const modalMatricula = document.getElementById('modalMatricula')
  const modalExcluir   = document.getElementById('modalExcluir')
  const alunoForm      = document.getElementById('alunoForm')
  const buscaInput     = document.getElementById('buscaInput')
  const filtroStatus   = document.getElementById('filtroStatus')
  const tabelaAlunos   = document.getElementById('tabelaAlunos')
  const totalAlunos    = document.getElementById('totalAlunos')
  const loadingState   = document.getElementById('loadingState')
  const emptyState     = document.getElementById('emptyState')
  const errorState     = document.getElementById('errorState')
  const tableWrapper   = document.getElementById('tableWrapper')

  // ========================= MODAL ALUNO =========================

  function abrirModal(edicao = false) {
    document.getElementById('modalTitulo').textContent = edicao ? 'Editar Aluno'      : 'Novo Aluno'
    document.getElementById('submitLabel').textContent = edicao ? 'Salvar Alterações' : 'Cadastrar Aluno'
    document.getElementById('erroMsg').classList.add('hidden')
    modal.classList.remove('hidden')
    modal.classList.add('flex')
  }

  function fecharModal() {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
    alunoForm.reset()
    editandoId = null
  }

  document.getElementById('novoAlunoBtn').addEventListener('click', () => abrirModal(false))
  document.getElementById('closeModal').addEventListener('click', fecharModal)
  document.getElementById('cancelModal').addEventListener('click', fecharModal)

  // ========================= SUBMIT ALUNO =========================

  alunoForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const btn = document.getElementById('submitBtn')
    btn.disabled = true

    const payload = {
      nome:   document.getElementById('nome').value.trim(),
      cpf:    document.getElementById('cpf').value.trim()   || null,
      email:  document.getElementById('email').value.trim(),
      status: document.getElementById('status').value
    }

    try {
      const url    = editandoId ? `${API}/alunos/${editandoId}` : `${API}/alunos`
      const method = editandoId ? 'PUT' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')

      fecharModal()
      carregarAlunos()

    } catch(err) {
      const el = document.getElementById('erroMsg')
      el.textContent = err.message
      el.classList.remove('hidden')
    } finally {
      btn.disabled = false
    }
  })

  // ========================= EDITAR =========================

  async function abrirEdicao(id) {
    try {
      const res  = await fetch(`${API}/alunos/${id}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      editandoId = id

      document.getElementById('nome').value   = data.nome   || ''
      document.getElementById('cpf').value    = data.cpf    || ''
      document.getElementById('email').value  = data.email  || ''
      document.getElementById('status').value = data.status || 'ativo'

      abrirModal(true)

    } catch(err) {
      alert('Erro ao carregar aluno: ' + err.message)
    }
  }

  // ========================= EXCLUSÃO =========================

  function confirmarExclusao(id, nome) {
    excluindoId = id
    document.getElementById('nomeExcluir').textContent = nome
    modalExcluir.classList.remove('hidden')
    modalExcluir.classList.add('flex')
  }

  document.getElementById('cancelExcluir').addEventListener('click', () => {
    modalExcluir.classList.add('hidden')
    modalExcluir.classList.remove('flex')
    excluindoId = null
  })

  document.getElementById('confirmarExcluir').addEventListener('click', async () => {
    if (!excluindoId) return
    try {
      const res  = await fetch(`${API}/alunos/${excluindoId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      modalExcluir.classList.add('hidden')
      modalExcluir.classList.remove('flex')
      excluindoId = null
      carregarAlunos()
    } catch(err) {
      alert('Erro ao excluir: ' + err.message)
    }
  })

  // ========================= MODAL MATRÍCULA =========================

  async function abrirModalMatricula(alunoId, alunoNome) {
    matriculaAlunoIdAtual = alunoId
    document.getElementById('matriculaAlunoNome').textContent = alunoNome
    document.getElementById('erroMatricula').classList.add('hidden')
    document.getElementById('matriculaTurmaId').innerHTML = '<option value="">Selecione primeiro um curso</option>'

    try {
      const res  = await fetch(`${API}/cursos`)
      const data = await res.json()
      const sel  = document.getElementById('matriculaCursoId')
      sel.innerHTML = '<option value="">Selecione um curso</option>'
      data.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`
      })
    } catch(err) {
      console.error('Erro ao carregar cursos:', err)
    }

    modalMatricula.classList.remove('hidden')
    modalMatricula.classList.add('flex')
  }

  function fecharModalMatricula() {
    modalMatricula.classList.add('hidden')
    modalMatricula.classList.remove('flex')
    document.getElementById('matriculaCursoId').innerHTML = '<option value="">Selecione um curso</option>'
    document.getElementById('matriculaTurmaId').innerHTML = '<option value="">Selecione primeiro um curso</option>'
    matriculaAlunoIdAtual = null
  }

  document.getElementById('closeModalMatricula').addEventListener('click', fecharModalMatricula)
  document.getElementById('cancelMatricula').addEventListener('click', fecharModalMatricula)

  document.getElementById('matriculaCursoId').addEventListener('change', async function() {
    const cursoId = this.value
    const sel     = document.getElementById('matriculaTurmaId')

    if (!cursoId) {
      sel.innerHTML = '<option value="">Selecione primeiro um curso</option>'
      return
    }

    sel.innerHTML = '<option value="">Carregando turmas...</option>'

    try {
      const res  = await fetch(`${API}/turmas/${cursoId}`)
      const data = await res.json()
      sel.innerHTML = '<option value="">Selecione uma turma</option>'
      if (data.length === 0) {
        sel.innerHTML = '<option value="">Nenhuma turma disponível neste curso</option>'
        return
      }
      data.forEach(t => {
        // A turma é um grupo: mostra o código e as disciplinas da grade
        const nomes   = (t.disciplinas || []).map(d => d.disciplina).filter(Boolean)
        const resumo  = nomes.length ? nomes.join(', ') : 'sem disciplinas na grade'
        const encerrada = String(t.status).toLowerCase() === 'encerrada'
        const lotada    = (t.vagas_livres ?? 1) <= 0
        const sufixo    = encerrada ? ' [encerrada]' : lotada ? ' [sem vagas]' : ` · ${t.vagas_livres ?? '?'} vaga(s) livre(s)`
        const opcao = new Option(`${t.codigo || 'Turma ' + t.id} — ${resumo}${sufixo}`, t.id)
        opcao.disabled = encerrada || lotada
        sel.append(opcao)
      })
    } catch(err) {
      sel.innerHTML = '<option value="">Erro ao carregar turmas</option>'
    }
  })

  document.getElementById('confirmarMatricula').addEventListener('click', async () => {
    const turma_id = document.getElementById('matriculaTurmaId').value

    if (!turma_id) {
      const el = document.getElementById('erroMatricula')
      el.textContent = 'Selecione uma turma antes de continuar'
      el.classList.remove('hidden')
      return
    }

    try {
      const res  = await fetch(`${API}/alunos/${matriculaAlunoIdAtual}/matriculas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ turma_id: Number(turma_id) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fecharModalMatricula()
      carregarAlunos()
    } catch(err) {
      const el = document.getElementById('erroMatricula')
      el.textContent = err.message
      el.classList.remove('hidden')
    }
  })

  // ========================= CARREGAR ALUNOS =========================

  async function carregarAlunos() {
    loadingState.classList.remove('hidden')
    emptyState.classList.add('hidden')
    errorState.classList.add('hidden')
    tableWrapper.classList.add('hidden')

    try {
      const res  = await fetch(`${API}/alunos`)
      if (!res.ok) throw new Error('Servidor retornou erro')
      const data = await res.json()
      todosAlunos = data
      renderizarTabela(data)
    } catch(err) {
      loadingState.classList.add('hidden')
      errorState.classList.remove('hidden')
      errorState.classList.add('flex')
    }
  }

  // ========================= RENDERIZAR TABELA =========================

  function renderizarTabela(alunos) {
    loadingState.classList.add('hidden')

    const total = alunos.length
    totalAlunos.textContent = `${total} aluno${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`

    if (total === 0) {
      emptyState.classList.remove('hidden')
      emptyState.classList.add('flex')
      tableWrapper.classList.add('hidden')
      return
    }

    emptyState.classList.add('hidden')
    tableWrapper.classList.remove('hidden')

    tabelaAlunos.innerHTML = alunos.map(aluno => {

      const turmasAtivas = (aluno.matriculas || [])
        .filter(m => m.status === 'ativa')
        .map(m => m.turmas?.codigo || m.turmas?.disciplina || '—')

      const turmasLabel = turmasAtivas.length > 0
        ? turmasAtivas.slice(0, 2).join(', ') + (turmasAtivas.length > 2 ? ` +${turmasAtivas.length - 2}` : '')
        : '<span class="text-gray-300">Sem matrícula</span>'

      return `
        <tr class="hover:bg-gray-50 duration-150">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-[#07224f]/10 text-[#07224f] flex items-center justify-center font-semibold text-sm flex-shrink-0">
                ${aluno.nome.charAt(0).toUpperCase()}
              </div>
              <p class="font-medium text-gray-800 text-sm">${aluno.nome}</p>
            </div>
          </td>
          <td class="px-6 py-4 hidden sm:table-cell">
            <span class="text-sm text-gray-500 font-mono">${aluno.cpf || '—'}</span>
          </td>
          <td class="px-6 py-4 hidden md:table-cell">
            <span class="text-sm text-gray-600">${aluno.email || '—'}</span>
          </td>
          <td class="px-6 py-4 hidden lg:table-cell">
            <span class="text-sm text-gray-600">${turmasLabel}</span>
          </td>
          <td class="px-6 py-4">
            ${badgeStatus(aluno.status)}
          </td>
          <td class="px-6 py-4 text-center w-px whitespace-nowrap">
            <div class="flex items-center justify-center gap-1">
              <button onclick="abrirVisaoAluno(${aluno.id})"
                class="w-8 h-8 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 duration-200 flex items-center justify-center"
                title="Matrícula e frequência" data-ajuda="alunos.btnVisao">
                <i class="fa-solid fa-graduation-cap text-sm"></i>
              </button>
              <button onclick="abrirEdicao(${aluno.id})"
                class="w-8 h-8 rounded-lg text-gray-400 hover:text-[#07224f] hover:bg-gray-100 duration-200 flex items-center justify-center"
                title="Editar" data-ajuda="alunos.btnEditar">
                <i class="fa-regular fa-pen-to-square text-sm"></i>
              </button>
              <button onclick="confirmarExclusao(${aluno.id}, '${aluno.nome.replace(/'/g, "\\'")}')"
                class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 duration-200 flex items-center justify-center"
                title="Excluir" data-ajuda="alunos.btnExcluir">
                <i class="fa-regular fa-trash-can text-sm"></i>
              </button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  // ========================= BADGE STATUS =========================

  function badgeStatus(status) {
    const map = {
      ativo:   { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Ativo'   },
      inativo: { bg: 'bg-gray-100', text: 'text-gray-600',  dot: 'bg-gray-400',  label: 'Inativo' },
    }
    const s = map[status] || map['inativo']
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}">
        <span class="w-1.5 h-1.5 rounded-full ${s.dot}"></span>${s.label}
      </span>`
  }

  // ========================= FILTROS =========================

  function filtrar() {
    const busca  = buscaInput.value.toLowerCase()
    const status = filtroStatus.value
    const result = todosAlunos.filter(a =>
      (!busca  || a.nome?.toLowerCase().includes(busca) || a.cpf?.includes(busca) || a.email?.toLowerCase().includes(busca)) &&
      (!status || a.status === status)
    )
    renderizarTabela(result)
  }

  buscaInput.addEventListener('input', filtrar)
  filtroStatus.addEventListener('change', filtrar)

  // ========================= MÁSCARA CPF =========================

  document.getElementById('cpf').addEventListener('input', function() {
    let v = this.value.replace(/\D/g, '').slice(0, 11)
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    this.value = v
  })

  // ========================= VISÃO GERAL DO ALUNO =========================

  const modalVisao = document.getElementById('modalVisao')
  let visaoAlunoAtual = null

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  const pct = v => (v === null || v === undefined) ? '—' : `${v}%`
  const dataBR = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—' }
  const periodo = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})/); return m ? `${Number(m[2]) <= 6 ? '1º' : '2º'} Semestre ${m[1]}` : '—' }

  function corFrequencia(v) {
    if (v === null || v === undefined) return 'bg-gray-100 text-gray-500'
    if (v >= 75) return 'bg-green-50 text-green-700'
    if (v >= 60) return 'bg-amber-50 text-amber-700'
    return 'bg-red-50 text-red-700'
  }

  function selecionarAba(aba) {
    document.querySelectorAll('.aba-visao').forEach(b => {
      const ativa = b.dataset.aba === aba
      b.setAttribute('aria-selected', ativa)
      b.classList.toggle('text-[#07224f]', ativa)
      b.classList.toggle('border-[#07224f]', ativa)
      b.classList.toggle('text-gray-500', !ativa)
      b.classList.toggle('border-transparent', !ativa)
    })
    document.getElementById('painelDados').classList.toggle('hidden', aba !== 'dados')
    document.getElementById('painelCursos').classList.toggle('hidden', aba !== 'cursos')
  }
  document.querySelectorAll('.aba-visao').forEach(b => b.addEventListener('click', () => selecionarAba(b.dataset.aba)))

  const matriculasAbertas = new Set()

  function alternarMatricula(id) {
    matriculasAbertas.has(id) ? matriculasAbertas.delete(id) : matriculasAbertas.add(id)
    const aberta = matriculasAbertas.has(id)
    const det = document.getElementById(`matDet${id}`)
    const btn = document.getElementById(`matBtn${id}`)
    if (!det || !btn) return
    det.classList.toggle('hidden', !aberta)
    btn.setAttribute('aria-expanded', aberta)
    btn.querySelector('i').className = `fa-solid ${aberta ? 'fa-minus' : 'fa-plus'}`
  }

  function linhaMatricula(m) {
    const f = m.frequencia
    const aberta = matriculasAbertas.has(m.id)
    const disc = m.por_disciplina || []
    const tabela = disc.length ? `
      <div class="mt-5 border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div class="grid grid-cols-[2fr_2fr_1fr_1fr] gap-3 px-4 py-2.5 bg-[#07224f] text-sm font-semibold text-white">
          <span>Disciplina</span><span>Professor</span><span>Frequência</span><span>Nota</span>
        </div>
        ${disc.map(d => `
        <div class="grid grid-cols-[2fr_2fr_1fr_1fr] gap-3 px-4 py-3 items-center border-t border-gray-200 text-base text-gray-900">
          <span class="font-medium">${esc(d.disciplina)}</span>
          <span class="text-gray-700">${esc(d.professor || '—')}</span>
          <span><span class="text-sm font-semibold px-2.5 py-1 rounded-full ${corFrequencia(d.percentual)}" title="${d.presentes} presenças e ${d.faltas} faltas em ${d.total_aulas} aulas">${pct(d.percentual)}</span></span>
          <span class="text-gray-700">${d.nota ?? '—'}</span>
        </div>`).join('')}
      </div>` : `<p class="mt-4 text-base text-gray-500">Nenhuma disciplina cadastrada na grade desta turma.</p>`
    return `
      <div>
        <button type="button" id="matBtn${m.id}" data-ajuda="alunos.visaoMais" onclick="alternarMatricula(${m.id})" aria-expanded="${aberta}" class="w-full flex items-center justify-between gap-4 px-5 py-5 text-left hover:bg-gray-50">
          <span class="min-w-0">
            <span class="block text-lg font-semibold text-gray-900">${esc(m.curso?.nome || '—')}</span>
            <span class="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1.5 text-base">
              <span class="text-gray-500">${esc(m.turma?.codigo || '')}</span>
              <span class="text-gray-800">${periodo(m.matriculado_em)}</span>
              <span class="text-sm font-semibold px-2.5 py-1 rounded-full ${corFrequencia(f.percentual)}" title="${f.presentes} presenças e ${f.faltas} faltas em ${f.total_aulas} aulas">Frequência ${pct(f.percentual)}</span>
              <span class="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700">Ativo</span>
            </span>
          </span>
          <span class="w-8 h-8 shrink-0 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center text-sm"><i class="fa-solid ${aberta ? 'fa-minus' : 'fa-plus'}"></i></span>
        </button>
        <div id="matDet${m.id}" class="${aberta ? '' : 'hidden'} px-5 pb-6">
          ${tabela.replace('mt-5 ', 'mt-1 ').replace('mt-4 ', 'mt-1 ')}
        </div>
      </div>`
  }

  async function abrirVisaoAluno(alunoId) {
    visaoAlunoAtual = alunoId
    const aluno = todosAlunos.find(a => a.id === alunoId)
    document.getElementById('visaoNome').textContent = aluno?.nome || 'Aluno'
    document.getElementById('visaoContato').textContent = aluno?.email || ''
    document.getElementById('visaoCarregando').classList.remove('hidden')
    document.getElementById('visaoErro').classList.add('hidden')
    document.getElementById('painelDados').classList.add('hidden')
    document.getElementById('painelCursos').classList.add('hidden')
    selecionarAba('dados')
    document.getElementById('painelDados').classList.add('hidden')
    modalVisao.classList.remove('hidden')
    modalVisao.classList.add('flex')

    try {
      const res = await fetch(`${API}/alunos/${alunoId}/visao-geral`)
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error || 'Não foi possível carregar os dados do aluno.')

      const al = dados.aluno, r = dados.resumo
      document.getElementById('visaoNome').textContent = al.nome
      document.getElementById('visaoContato').textContent = al.email || ''
      document.getElementById('dadoNome').textContent = al.nome
      document.getElementById('dadoCpf').textContent = al.cpf || '—'
      document.getElementById('dadoEmail').textContent = al.email || '—'
      document.getElementById('dadoStatus').innerHTML = badgeStatus(al.status)
      document.getElementById('dadoCriado').textContent = dataBR(al.created_at)

      const ativas = dados.matriculas.filter(m => String(m.status).toLowerCase() === 'ativa')
      document.getElementById('visaoLista').innerHTML = ativas.length
        ? ativas.map(linhaMatricula).join('')
        : '<p class="px-4 py-8 text-center text-gray-500">Este aluno ainda não está matriculado em nenhuma turma.</p>'
      document.getElementById('visaoQtd').textContent = ativas.length ? `(${ativas.length})` : ''
      selecionarAba('dados')
    } catch (err) {
      const e = document.getElementById('visaoErro')
      e.textContent = err.message || 'Erro de conexão com o servidor.'
      e.classList.remove('hidden')
    } finally {
      document.getElementById('visaoCarregando').classList.add('hidden')
    }
  }

  function fecharVisaoAluno() {
    modalVisao.classList.add('hidden')
    modalVisao.classList.remove('flex')
    visaoAlunoAtual = null
  }

  document.getElementById('closeModalVisao').addEventListener('click', fecharVisaoAluno)
  modalVisao.addEventListener('click', e => { if (e.target === modalVisao) fecharVisaoAluno() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && visaoAlunoAtual !== null) fecharVisaoAluno() })
  document.getElementById('visaoNovaMatricula').addEventListener('click', () => {
    const aluno = todosAlunos.find(a => a.id === visaoAlunoAtual)
    if (!aluno) return
    fecharVisaoAluno()
    abrirModalMatricula(aluno.id, aluno.nome)
  })

  // ========================= INIT =========================

  carregarAlunos()

