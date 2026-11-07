// Consulta os professores e suas turmas no banco de dados.
(async () => {
  async function consultar(caminho) {
    const resposta = await fetch(`${window.SICEP_API_URL}${caminho}`, { signal: AbortSignal.timeout(15000) });
    if (!resposta.ok) throw new Error('Falha ao consultar professores');
    return resposta.json();
  }
  let professores, cursos, turmas;
  try {
    [professores, cursos] = await Promise.all([consultar('/professores'), consultar('/cursos')]);
    turmas = (await Promise.all(cursos.map(curso => consultar(`/turmas/${encodeURIComponent(curso.id)}`)))).flat();
  } catch {
    document.getElementById('totalAtivos').textContent = '—';
    document.getElementById('resultadoBusca').textContent = 'Não foi possível carregar os professores. Recarregue a página para tentar novamente.';
    return;
  }
  const ativos = professores.filter(professor => String(professor.status).toLowerCase() === 'ativo');
  const busca = document.getElementById('buscaProfessor');
  const lista = document.getElementById('listaProfessores');
  const detalhes = document.getElementById('detalhesProfessor');
  const painel = document.getElementById('painelLista');
  let ultimoProfessor;
  const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const escapar = texto => String(texto ?? '').replace(/[&<>"']/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caractere]));
  const iniciais = nome => nome.split(' ').filter(Boolean).filter((_, indice, partes) => indice === 0 || indice === partes.length - 1).map(parte => parte[0]).join('');
  const vinculadas = id => turmas.filter(turma => turma.professor_id === id);
  const quantidade = total => `${total} ${total === 1 ? 'turma vinculada' : 'turmas vinculadas'}`;

  function renderizarLista() {
    const termo = normalizar(busca.value.trim());
    const encontrados = ativos.filter(professor => normalizar(professor.nome).includes(termo));
    document.getElementById('resultadoBusca').textContent = `${encontrados.length} ${encontrados.length === 1 ? 'professor encontrado' : 'professores encontrados'}`;
    lista.innerHTML = encontrados.map(professor => `
      <article class="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5">
        <div class="flex items-start gap-4">
          <div aria-hidden="true" class="w-12 h-12 shrink-0 rounded-full bg-blue-50 text-[#07224f] flex items-center justify-center font-semibold">${iniciais(professor.nome)}</div>
          <div class="min-w-0"><h3 class="font-semibold text-gray-900">${escapar(professor.nome)}</h3><p class="text-sm text-gray-500 mt-1">${escapar(professor.especialidade)}</p></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 mt-auto">
          <span class="text-sm text-gray-500"><i class="fa-solid fa-graduation-cap mr-2" aria-hidden="true"></i>${quantidade(vinculadas(professor.id).length)}</span>
          <button type="button" data-professor="${professor.id}" aria-label="Ver detalhes de ${escapar(professor.nome)}" class="text-sm font-semibold text-[#07224f] rounded-md px-2 py-2 hover:bg-blue-50">Ver detalhes <span aria-hidden="true">→</span></button>
        </div>
      </article>`).join('');
    document.getElementById('semResultados').hidden = encontrados.length > 0;
  }

  function renderizarRota() {
    const id = /^#professor=(\d+)$/.exec(location.hash)?.[1];
    const professor = ativos.find(item => item.id === Number(id));
    painel.hidden = Boolean(professor);
    detalhes.hidden = !professor;
    if (!professor) {
      if (ultimoProfessor) {
        lista.querySelector(`[data-professor="${ultimoProfessor}"]`)?.focus();
        ultimoProfessor = undefined;
      }
      return;
    }
    ultimoProfessor = professor.id;
    const aulas = vinculadas(professor.id);
    detalhes.innerHTML = `
      <a href="#" class="inline-flex items-center gap-2 text-sm text-[#07224f] font-medium mb-6 rounded-md py-2">← Voltar para professores</a>
      <article class="bg-white border border-gray-200 rounded-2xl p-5 md:p-8 mb-6">
        <div class="flex items-center gap-4 mb-7"><div aria-hidden="true" class="w-14 h-14 shrink-0 rounded-full bg-blue-50 text-[#07224f] flex items-center justify-center text-lg font-semibold">${iniciais(professor.nome)}</div><div><h2 id="nomeProfessor" tabindex="-1" class="text-xl font-semibold">${escapar(professor.nome)}</h2><p class="text-sm text-green-700 mt-1">Professor ativo</p></div></div>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          ${[['Nome completo', professor.nome], ['E-mail', professor.email], ['Telefone', professor.telefone || 'Não informado'], ['Especialidade', professor.especialidade]].map(([rotulo, valor]) => `<div class="min-w-0"><dt class="text-gray-500 mb-1">${rotulo}</dt><dd class="font-medium break-words">${escapar(valor)}</dd></div>`).join('')}
        </dl>
      </article>
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 class="text-lg font-semibold">Turmas e horários</h3><p class="text-sm text-gray-500">${quantidade(aulas.length)}</p></div>
      ${aulas.length ? `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${aulas.map(turma => {
        const curso = cursos.find(item => item.id === turma.curso_id);
        return `<article class="bg-white border border-gray-200 rounded-2xl p-6"><div class="flex items-center justify-between gap-3 mb-4"><h4 class="font-semibold text-[#07224f]">${escapar(turma.codigo)}</h4><span class="text-xs rounded-full px-3 py-1 ${turma.status === 'ativa' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}">${turma.status === 'ativa' ? 'Ativa' : 'Encerrada'}</span></div><dl class="space-y-3 text-sm">${[['Curso', curso?.nome || 'Curso não informado'], ['Disciplina', turma.disciplina], ['Horário', turma.horario], ['Sala', turma.sala]].map(([rotulo, valor]) => `<div><dt class="text-gray-500">${rotulo}</dt><dd class="font-medium mt-1">${escapar(valor)}</dd></div>`).join('')}</dl></article>`;
      }).join('')}</div>` : '<div class="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-500">Este professor ainda não possui turmas vinculadas.</div>'}`;
    document.getElementById('nomeProfessor').focus();
    document.getElementById('conteudoProfessores').scrollTop = 0;
  }

  document.getElementById('totalAtivos').textContent = ativos.length;
  busca.addEventListener('input', renderizarLista);
  document.getElementById('limparBusca').addEventListener('click', () => {
    busca.value = '';
    renderizarLista();
    busca.focus();
  });
  lista.addEventListener('click', evento => {
    const botao = evento.target.closest('[data-professor]');
    if (botao) location.hash = `professor=${botao.dataset.professor}`;
  });
  window.addEventListener('hashchange', renderizarRota);
  renderizarLista();
  renderizarRota();
})();
