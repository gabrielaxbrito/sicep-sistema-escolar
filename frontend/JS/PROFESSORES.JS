
(() => {

  // ========================================
  // CONFIGURAÇÕES
  // ========================================

  const API_BASE = String(
    window.SICEP_API_URL || 'http://localhost:3000'
  ).replace(/\/+$/, '');

  const API_URL = `${API_BASE}/professores`;

  const busca = document.getElementById('buscaProfessor');
  const lista = document.getElementById('listaProfessores');
  const detalhes = document.getElementById('detalhesProfessor');
  const painel = document.getElementById('painelLista');

  let professores = [];
  let cursos = [];
  let turmas = [];
  let ultimoProfessor;
  let carregando = false;

  // ========================================
  // FUNÇÕES AUXILIARES
  // ========================================

  const normalizar = texto =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');

  const escapar = texto =>
    String(texto ?? '').replace(/[&<>"']/g, caractere => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[caractere]));

  const iniciais = nome =>
    String(nome || '')
      .split(' ')
      .filter(Boolean)
      .filter((_, indice, partes) =>
        indice === 0 || indice === partes.length - 1
      )
      .map(parte => parte[0])
      .join('');

  const ativos = () =>
    professores.filter(professor =>
      normalizar(professor.status) === 'ativo'
    );

  const vinculadas = id =>
    turmas.filter(turma =>
      String(turma.professor_id) === String(id)
    );

  const quantidade = total =>
    `${total} ${total === 1 ? 'turma vinculada' : 'turmas vinculadas'}`;

  // ========================================
  // TOKEN
  // ========================================

  function obterToken() {

    for (const armazenamento of [
      window.localStorage,
      window.sessionStorage
    ]) {

      try {

        const token = armazenamento.getItem('sicep.token');

        if (token) return token;

      } catch (erro) {

        console.warn('Erro ao acessar token:', erro);

      }

    }

    return null;
  }

  // ========================================
  // REQUISIÇÃO
  // ========================================

  async function requisicao(url) {

    const token = obterToken();

    if (!token) {
      throw new Error('Token não encontrado. Faça login novamente.');
    }

    const resposta = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {

      throw new Error(
        dados.error || `Erro HTTP ${resposta.status}`
      );

    }

    return dados;
  }

  // ========================================
  // LISTAGEM
  // ========================================

  function renderizarLista() {

    const termo = normalizar(busca.value.trim());

    const encontrados = ativos().filter(professor =>
      normalizar(professor.nome).includes(termo)
    );

    document.getElementById('resultadoBusca').textContent =
      `${encontrados.length} ${
        encontrados.length === 1
          ? 'professor encontrado'
          : 'professores encontrados'
      }`;

    lista.innerHTML = encontrados.map(professor => `
      <article class="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5">

        <div class="flex items-start gap-4">

          <div aria-hidden="true" class="w-12 h-12 shrink-0 rounded-full bg-blue-50 text-[#07224f] flex items-center justify-center font-semibold">
            ${escapar(iniciais(professor.nome))}
          </div>

          <div class="min-w-0">

            <h3 class="font-semibold text-gray-900">
              ${escapar(professor.nome)}
            </h3>

            <p class="text-sm text-gray-500 mt-1">
              ${escapar(professor.especialidade || 'Não informado')}
            </p>

          </div>

        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 mt-auto">

          <span class="text-sm text-gray-500">
            <i class="fa-solid fa-graduation-cap mr-2" aria-hidden="true"></i>
            ${quantidade(vinculadas(professor.id).length)}
          </span>

          <button
            type="button"
            data-professor="${escapar(professor.id)}"
            data-ajuda="prof.btnDetalhes"
            aria-label="Ver detalhes de ${escapar(professor.nome)}"
            class="text-sm font-semibold text-[#07224f] rounded-md px-2 py-2 hover:bg-blue-50"
          >
            Ver detalhes <span aria-hidden="true">→</span>
          </button>

        </div>

      </article>
    `).join('');

    document.getElementById('semResultados').hidden =
      encontrados.length > 0;
  }

  // ========================================
  // DETALHES
  // ========================================

  function renderizarRota() {

    const id = /^#professor=(\d+)$/.exec(location.hash)?.[1];

    const professor = ativos().find(item =>
      String(item.id) === String(id)
    );

    painel.hidden = Boolean(professor);
    detalhes.hidden = !professor;

    if (!professor) {

      if (ultimoProfessor) {

        lista.querySelector(
          `[data-professor="${ultimoProfessor}"]`
        )?.focus();

        ultimoProfessor = undefined;
      }

      return;
    }

    ultimoProfessor = professor.id;

    const aulas = vinculadas(professor.id);

    detalhes.innerHTML = `

      <a href="#" class="inline-flex items-center gap-2 text-sm text-[#07224f] font-medium mb-6 rounded-md py-2">
        ← Voltar para professores
      </a>

      <article class="bg-white border border-gray-200 rounded-2xl p-5 md:p-8 mb-6">

        <div class="flex items-center gap-4 mb-7">

          <div aria-hidden="true" class="w-14 h-14 shrink-0 rounded-full bg-blue-50 text-[#07224f] flex items-center justify-center text-lg font-semibold">
            ${escapar(iniciais(professor.nome))}
          </div>

          <div>

            <h2 id="nomeProfessor" tabindex="-1" class="text-xl font-semibold">
              ${escapar(professor.nome)}
            </h2>

            <p class="text-sm text-green-700 mt-1">
              Professor ativo
            </p>

          </div>

        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">

          ${[
            ['Nome completo', professor.nome],
            ['E-mail', professor.email || 'Não informado'],
            ['Telefone', professor.telefone || 'Não informado'],
            ['Especialidade', professor.especialidade || 'Não informado']
          ].map(([rotulo, valor]) => `

            <div class="min-w-0">

              <dt class="text-gray-500 mb-1">
                ${rotulo}
              </dt>

              <dd class="font-medium break-words">
                ${escapar(valor)}
              </dd>

            </div>

          `).join('')}

        </dl>

      </article>

      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">

        <h3 class="text-lg font-semibold">
          Turmas e horários
        </h3>

        <p class="text-sm text-gray-500">
          ${quantidade(aulas.length)}
        </p>

      </div>

      ${aulas.length
        ? `

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

            ${aulas.map(turma => {

              const curso = cursos.find(item =>
                String(item.id) === String(turma.curso_id)
              );

              const statusAtiva =
                normalizar(turma.status) === 'ativa';

              return `

                <article class="bg-white border border-gray-200 rounded-2xl p-6">

                  <div class="flex items-center justify-between gap-3 mb-4">

                    <h4 class="font-semibold text-[#07224f]">
                      ${escapar(turma.codigo || 'Sem código')}
                    </h4>

                    <span class="text-xs rounded-full px-3 py-1 ${
                      statusAtiva
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }">
                      ${statusAtiva ? 'Ativa' : 'Encerrada'}
                    </span>

                  </div>

                  <dl class="space-y-3 text-sm">

                    ${[
                      ['Curso', curso?.nome || 'Curso não informado'],
                      ['Disciplina', turma.disciplina || 'Não informado'],
                      ['Horário', turma.horario || 'Não informado'],
                      ['Sala', turma.sala || 'Não informado']
                    ].map(([rotulo, valor]) => `

                      <div>

                        <dt class="text-gray-500">
                          ${rotulo}
                        </dt>

                        <dd class="font-medium mt-1">
                          ${escapar(valor)}
                        </dd>

                      </div>

                    `).join('')}

                  </dl>

                </article>

              `;

            }).join('')}

          </div>

        `
        : `

          <div class="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-500">
            Este professor ainda não possui turmas vinculadas.
          </div>

        `
      }

    `;

    detalhes.querySelector('#nomeProfessor')?.focus();

    document.getElementById('conteudoProfessores').scrollTop = 0;
  }

  // ========================================
  // CARREGAR DADOS
  // ========================================

  async function carregarProfessores() {

    if (carregando) return;

    carregando = true;

    lista.innerHTML = `
      <p class="text-sm text-gray-500">
        Carregando professores...
      </p>
    `;

    try {

      console.info('API de professores:', API_URL);

      const dados = await requisicao(API_URL);

      professores = dados.professores || [];
      cursos = dados.cursos || [];
      turmas = dados.turmas || [];

      window.dadosProfessores = {
        professores,
        cursos,
        turmas
      };

      document.getElementById('totalAtivos').textContent =
        dados.total_ativos ?? ativos().length;

      renderizarLista();
      renderizarRota();

      console.info(
        'Professores carregados:',
        professores.length
      );

    } catch (erro) {

      console.error('Erro ao carregar professores:', erro);

      lista.innerHTML = `

        <div class="bg-white border border-gray-200 rounded-2xl p-6 text-sm text-red-600">

          Não foi possível carregar os professores.
          Verifique sua conexão com o servidor e tente novamente.

        </div>

      `;

      document.getElementById('resultadoBusca').textContent =
        `Erro ao carregar professores: ${erro.message}`;

    } finally {

      carregando = false;

    }
  }

  // ========================================
  // EVENTOS
  // ========================================

  busca.addEventListener('input', renderizarLista);

  document.getElementById('limparBusca').addEventListener('click', () => {

    busca.value = '';

    renderizarLista();

    busca.focus();

  });

  lista.addEventListener('click', evento => {

    const botao = evento.target.closest('[data-professor]');

    if (botao) {
      location.hash = `professor=${botao.dataset.professor}`;
    }

  });

  window.addEventListener('hashchange', renderizarRota);

  // ========================================
  // INICIALIZAÇÃO
  // ========================================

  carregarProfessores();

})();