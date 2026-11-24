(() => {
  const API = 'http://localhost:3000';
  const el = id => document.getElementById(id);
  const modal = el('modal');
  const form = el('cursoForm');
  const salvar = form.querySelector('[type="submit"]');
  let editandoId = null;      // curso aberto no modal (null = ainda não salvo)
  let editandoCurso = null;
  let disciplinaEditandoId = null;
  let cursoEmEdicao = false;  // true: veio de "Editar curso"

  const erro = document.createElement('p');
  erro.className = 'text-sm text-red-600 mb-4';
  erro.setAttribute('role', 'alert');
  form.prepend(erro);

  async function consultar(caminho, opcoes) {
    const resposta = await fetch(`${API}${caminho}`, opcoes);
    const dados = await resposta.json().catch(() => null);
    if (dados === null) throw new Error('O servidor não reconheceu esta rota. Reinicie o backend (npm run dev) para carregar a versão nova.');
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível salvar os dados.');
    return dados;
  }
  const json = (method, corpo) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  function texto(tag, conteudo, classe = '') {
    const node = document.createElement(tag); node.textContent = conteudo; node.className = classe; return node;
  }

  // ===== ABAS =====
  function aba(nome) {
    document.querySelectorAll('.aba-curso').forEach(b => {
      const ativa = b.dataset.aba === nome;
      const bloqueada = b.dataset.aba === 'disciplinas' && editandoId === null;
      b.setAttribute('aria-selected', ativa);
      b.disabled = bloqueada;
      b.classList.toggle('text-[#07224f]', ativa);
      b.classList.toggle('border-[#07224f]', ativa);
      b.classList.toggle('text-gray-500', !ativa);
      b.classList.toggle('border-transparent', !ativa);
      b.classList.toggle('opacity-50', bloqueada);
      b.classList.toggle('cursor-not-allowed', bloqueada);
      b.title = bloqueada ? 'Salve os dados do curso primeiro' : '';
    });
    form.classList.toggle('hidden', nome !== 'dados');
    el('painelDisc').classList.toggle('hidden', nome !== 'disciplinas');
    el('modalSub').textContent = nome === 'dados'
      ? 'Informe os dados do curso.'
      : `Disciplinas do curso ${editandoCurso?.nome || ''}`.trim();
    (nome === 'dados' ? el('nome') : el('discNome')).focus();
    if (nome === 'disciplinas') carregarDisciplinas();
  }
  document.querySelectorAll('.aba-curso').forEach(b => b.addEventListener('click', () => { if (!b.disabled) aba(b.dataset.aba); }));

  function abrir(curso = null, abaInicial = 'dados') {
    form.reset(); erro.textContent = '';
    editandoId = curso?.id ?? null; editandoCurso = curso; cursoEmEdicao = !!curso;
    el('nome').value = curso?.nome || '';
    el('duracao').value = curso?.carga_horaria ?? '';
    el('modalTitulo').textContent = curso ? 'Editar curso' : 'Novo curso';
    salvar.textContent = curso ? 'Salvar alterações' : 'Salvar e continuar';
    limparFormDisciplina();
    el('discLista').replaceChildren();
    modal.classList.remove('hidden'); modal.classList.add('flex');
    aba(abaInicial);
  }
  function fechar() {
    modal.classList.add('hidden'); modal.classList.remove('flex'); el('novoCursoBtn').focus();
    carregar();
  }
  el('novoCursoBtn').addEventListener('click', () => abrir());
  el('closeModal').addEventListener('click', fechar);
  el('cancelModal').addEventListener('click', fechar);
  el('concluirModal').addEventListener('click', fechar);
  modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) fechar(); });

  // ===== ABA 1: DADOS DO CURSO =====
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const nome = el('nome').value.trim();
    if (!nome) { erro.textContent = 'Informe o nome do curso.'; el('nome').focus(); return; }
    salvar.disabled = true; erro.textContent = '';
    const corpo = { nome, carga_horaria: Number(el('duracao').value) };
    try {
      if (editandoId === null) {
        const criado = await consultar('/cursos', json('POST', corpo));
        const curso = Array.isArray(criado) ? criado[0] : criado;
        editandoId = curso.id; editandoCurso = { ...curso, ...corpo };
        el('modalTitulo').textContent = 'Novo curso';
        aba('disciplinas');                       // segue para a segunda aba
      } else {
        await consultar(`/cursos/${encodeURIComponent(editandoId)}`, json('PUT', corpo));
        editandoCurso = { ...editandoCurso, ...corpo };
        if (cursoEmEdicao) fechar(); else aba('disciplinas');
      }
    } catch (falha) { erro.textContent = falha.message || 'Verifique a conexão com o servidor.'; }
    finally { salvar.disabled = false; }
  });

  // ===== ABA 2: DISCIPLINAS =====
  const discForm = el('discForm');
  const discErro = el('discErro');

  function limparFormDisciplina() {
    disciplinaEditandoId = null; discForm.reset(); discErro.textContent = '';
    el('discSalvar').textContent = 'Adicionar'; el('discCancelar').classList.add('hidden');
  }
  el('discCancelar').addEventListener('click', () => { limparFormDisciplina(); el('discNome').focus(); });

  async function carregarDisciplinas() {
    const lista = el('discLista');
    lista.replaceChildren(texto('li', 'Carregando disciplinas...', 'p-4 text-sm text-gray-500'));
    try {
      const itens = await consultar(`/cursos/${encodeURIComponent(editandoId)}/disciplinas`);
      lista.replaceChildren();
      if (!itens.length) { lista.append(texto('li', 'Nenhuma disciplina cadastrada ainda.', 'p-4 text-sm text-gray-500')); return; }
      itens.forEach(d => {
        const li = texto('li', '', 'flex items-center justify-between gap-3 p-4');
        const info = document.createElement('div');
        info.append(texto('p', d.nome, 'font-medium text-gray-900'),
                    texto('p', d.carga_horaria ? `${d.carga_horaria} horas` : 'Carga horária não informada', 'text-xs text-gray-500'));
        const acoes = texto('div', '', 'flex gap-2');
        const editar = texto('button', 'Editar', 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50'); editar.type = 'button';
        editar.addEventListener('click', () => {
          disciplinaEditandoId = d.id; el('discNome').value = d.nome; el('discCarga').value = d.carga_horaria ?? '';
          el('discSalvar').textContent = 'Salvar'; el('discCancelar').classList.remove('hidden'); discErro.textContent = ''; el('discNome').focus();
        });
        const excluir = texto('button', 'Excluir', 'border border-red-200 text-red-600 rounded-lg px-3 py-1.5 text-sm hover:bg-red-50'); excluir.type = 'button';
        excluir.addEventListener('click', async () => {
          if (!confirm(`Excluir a disciplina "${d.nome}"?`)) return;
          excluir.disabled = true;
          try { await consultar(`/cursos/${encodeURIComponent(editandoId)}/disciplinas/${encodeURIComponent(d.id)}`, { method: 'DELETE' }); if (disciplinaEditandoId === d.id) limparFormDisciplina(); carregarDisciplinas(); }
          catch (falha) { discErro.textContent = falha.message; excluir.disabled = false; }
        });
        acoes.append(editar, excluir); li.append(info, acoes); lista.append(li);
      });
    } catch (falha) {
      lista.replaceChildren(texto('li', falha.message || 'Não foi possível carregar as disciplinas.', 'p-4 text-sm text-red-600'));
    }
  }

  discForm.addEventListener('submit', async e => {
    e.preventDefault(); discErro.textContent = '';
    const nome = el('discNome').value.trim();
    if (!nome) { discErro.textContent = 'Informe o nome da disciplina.'; el('discNome').focus(); return; }
    const corpo = { nome, carga_horaria: el('discCarga').value === '' ? null : Number(el('discCarga').value) };
    const botao = el('discSalvar'); botao.disabled = true;
    try {
      const base = `/cursos/${encodeURIComponent(editandoId)}/disciplinas`;
      if (disciplinaEditandoId === null) await consultar(base, json('POST', corpo));
      else await consultar(`${base}/${encodeURIComponent(disciplinaEditandoId)}`, json('PUT', corpo));
      limparFormDisciplina(); await carregarDisciplinas(); el('discNome').focus();
    } catch (falha) { discErro.textContent = falha.message || 'Verifique a conexão com o servidor.'; }
    finally { botao.disabled = false; }
  });

  // ===== LISTA DE CURSOS =====
  async function carregar() {
    const lista = el('cardsContainer');
    lista.replaceChildren(texto('p', 'Carregando cursos...', 'text-gray-500'));
    try {
      const cursos = await consultar('/cursos'); lista.replaceChildren();
      if (!cursos.length) lista.append(texto('p', 'Nenhum curso cadastrado. Clique em Novo curso para começar.', 'text-gray-500'));
      cursos.forEach(curso => {
        const card = texto('article', '', 'bg-white border border-gray-200 rounded-2xl p-6');
        const n = curso.total_disciplinas ?? 0;
        const duracao = curso.carga_horaria ? `Duração: ${curso.carga_horaria} horas` : 'Duração não informada';
        card.append(texto('h3', curso.nome, 'text-xl font-semibold mb-3'),
          texto('p', `${duracao} • ${n} disciplina${n === 1 ? '' : 's'}`, 'text-sm text-gray-500 mb-4'));
        const acoes = texto('div', '', 'flex flex-wrap gap-3');
        const editar = texto('button', 'Editar curso', 'border border-gray-300 rounded-lg px-4 py-2 text-sm');
        editar.addEventListener('click', () => abrir(curso));
        const disc = texto('button', 'Disciplinas', 'border border-gray-300 rounded-lg px-4 py-2 text-sm');
        disc.addEventListener('click', () => abrir(curso, 'disciplinas'));
        const excluir = texto('button', 'Excluir curso', 'border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm');
        excluir.addEventListener('click', async () => {
          if (!confirm('Excluir este curso? As turmas e disciplinas vinculadas também serão excluídas.')) return;
          excluir.disabled = true;
          try { await consultar(`/cursos/${encodeURIComponent(curso.id)}`, { method: 'DELETE' }); await carregar(); }
          catch (falha) { alert(falha.message); excluir.disabled = false; }
        });
        const turmas = texto('a', 'Ver turmas', 'border border-gray-300 rounded-lg px-4 py-2 text-sm');
        turmas.href = `TURMAS.HTML?curso=${encodeURIComponent(curso.id)}`;
        acoes.append(editar, disc, excluir, turmas); card.append(acoes); lista.append(card);
      });
    } catch (falha) {
      const tentar = texto('button', 'Tentar novamente', 'border border-gray-300 rounded-lg px-4 py-2');
      tentar.addEventListener('click', carregar);
      lista.replaceChildren(texto('p', 'Não foi possível carregar os cursos. Verifique o servidor.', 'text-red-600'), tentar);
    }
  }
  carregar();
})();
