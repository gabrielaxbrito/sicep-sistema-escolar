(() => {
  const API = 'http://localhost:3000';
  const el = id => document.getElementById(id);
  const modal = el('modal');
  const form = el('cursoForm');
  let editandoId = null;
  const salvar = form.querySelector('[type="submit"]');
  const erro = document.createElement('p');
  erro.className = 'text-sm text-red-600 mb-4';
  erro.setAttribute('role', 'alert');
  form.prepend(erro);
  function abrir(curso = null) {
    form.reset(); erro.textContent = ''; editandoId = curso?.id ?? null;
    el('nome').value = curso?.nome || '';
    el('duracao').value = curso?.carga_horaria ?? '';
    modal.querySelector('h2').textContent = curso ? 'Editar curso' : 'Novo curso';
    salvar.textContent = curso ? 'Salvar alterações' : 'Salvar curso';
    modal.classList.remove('hidden'); modal.classList.add('flex'); el('nome').focus();
  }
  function fechar() {
    modal.classList.add('hidden'); modal.classList.remove('flex'); el('novoCursoBtn').focus();
  }
  el('novoCursoBtn').addEventListener('click', () => abrir());
  el('closeModal').addEventListener('click', fechar);
  el('cancelModal').addEventListener('click', fechar);
  modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  async function consultar(caminho, opcoes) {
    const resposta = await fetch(`${API}${caminho}`, opcoes);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível salvar os dados.');
    return dados;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const nome = el('nome').value.trim();
    if (!nome) { erro.textContent = 'Informe o nome do curso.'; el('nome').focus(); return; }
    salvar.disabled = true; erro.textContent = '';
    try {
      await consultar(editandoId === null ? '/cursos' : `/cursos/${encodeURIComponent(editandoId)}`, {
        method: editandoId === null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, carga_horaria: Number(el('duracao').value) })
      });
      fechar(); await carregar();
    } catch (falha) { erro.textContent = falha.message || 'Verifique a conexão com o servidor.'; }
    finally { salvar.disabled = false; }
  });
  function texto(tag, conteudo, classe = '') {
    const node = document.createElement(tag); node.textContent = conteudo; node.className = classe; return node;
  }
  async function carregar() {
    const lista = el('cardsContainer');
    lista.replaceChildren(texto('p', 'Carregando cursos...', 'text-gray-500'));
    try {
      const cursos = await consultar('/cursos'); lista.replaceChildren();
      if (!cursos.length) lista.append(texto('p', 'Nenhum curso cadastrado. Clique em Novo curso para começar.', 'text-gray-500'));
      cursos.forEach(curso => {
        const card = texto('article', '', 'bg-white border border-gray-200 rounded-2xl p-6');
        card.append(texto('h3', curso.nome, 'text-xl font-semibold mb-3'), texto('p', curso.carga_horaria ? `Duração: ${curso.carga_horaria} horas` : 'Duração não informada', 'text-sm text-gray-500 mb-4'));
        const acoes = texto('div', '', 'flex flex-wrap gap-3');
        const editar = texto('button', 'Editar curso', 'border border-gray-300 rounded-lg px-4 py-2 text-sm');
        editar.addEventListener('click', () => abrir(curso));
        const excluir = texto('button', 'Excluir curso', 'border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm');
        excluir.addEventListener('click', async () => {
          if (!confirm('Excluir este curso? As turmas vinculadas também serão excluídas.')) return;
          excluir.disabled = true;
          try { await consultar(`/cursos/${encodeURIComponent(curso.id)}`, { method: 'DELETE' }); await carregar(); }
          catch (falha) { alert(falha.message); excluir.disabled = false; }
        });
        const turmas = texto('a', 'Ver turmas', 'border border-gray-300 rounded-lg px-4 py-2 text-sm');
        turmas.href = `TURMAS.HTML?curso=${encodeURIComponent(curso.id)}`;
        acoes.append(editar, excluir, turmas); card.append(acoes); lista.append(card);
      });
    } catch (falha) {
      const tentar = texto('button', 'Tentar novamente', 'border border-gray-300 rounded-lg px-4 py-2');
      tentar.addEventListener('click', carregar);
      lista.replaceChildren(texto('p', 'Não foi possível carregar os cursos. Verifique o servidor.', 'text-red-600'), tentar);
    }
  }
  carregar();
})();
