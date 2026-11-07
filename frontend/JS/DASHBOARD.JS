(() => {
  const mensagem = document.getElementById('dashboardMensagem');
  const atualizar = document.getElementById('atualizarDashboard');
  const formatador = new Intl.NumberFormat('pt-BR');
  let carregando = false;

  async function consultar(caminho, signal) {
    const resposta = await fetch(`http://localhost:3000${caminho}`, { cache: 'no-store', signal });
    if (!resposta.ok) throw new Error(`Falha em ${caminho}: HTTP ${resposta.status}`);
    return resposta.json();
  }

  // Compatibilidade com servidores que ainda não carregaram a nova rota /dashboard.
  async function consultarRotasExistentes(signal) {
    const [alunos, turmas, professores] = await Promise.allSettled([
      consultar('/alunos', signal),
      consultar('/cursos', signal).then(cursos => Promise.all(cursos.map(curso =>
        consultar(`/turmas/${encodeURIComponent(curso.id)}`, signal)))).then(grupos => grupos.flat()),
      consultar('/professores', signal)
    ]);
    const listaAlunos = alunos.status === 'fulfilled' ? alunos.value : null;
    const listaProfessores = professores.status === 'fulfilled' ? professores.value : null;
    const listaTurmas = turmas.status === 'fulfilled' ? turmas.value.filter(t => t.status === 'ativa') : null;
    const idsTurmas = new Set(listaTurmas?.map(t => String(t.id)));
    const vagas = listaTurmas?.reduce((total, turma) => total + Math.max(0, Number(turma.qtd_vagas_turmas) || 0), 0) ?? null;
    const matriculas = listaAlunos && listaTurmas ? listaAlunos.reduce((total, aluno) =>
      total + (aluno.matriculas || []).filter(m => m.status === 'ativa' && idsTurmas.has(String(m.turmas?.id))).length, 0) : null;
    return {
      alunos: listaAlunos?.filter(a => String(a.status).trim().toLowerCase() === 'ativo').length ?? null,
      turmas: listaTurmas?.length ?? null,
      professores: listaProfessores?.filter(p => String(p.status).trim().toLowerCase() === 'ativo').length ?? null,
      vagas, matriculas,
      ocupacao: vagas > 0 && matriculas !== null ? Math.round(matriculas / vagas * 100) : null,
      erros: [...(!listaProfessores ? ['professores'] : []), ...(!listaAlunos ? ['alunos'] : []), ...(!listaTurmas ? ['turmas'] : [])]
    };
  }

  async function carregarDashboard() {
    if (carregando) return;
    carregando = true;
    atualizar.disabled = true;
    mensagem.textContent = 'Carregando indicadores…';
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 15000);
    try {
      let dados;
      try {
        dados = await consultar('/dashboard', controlador.signal);
      } catch (erro) {
        if (controlador.signal.aborted) throw erro;
        dados = await consultarRotasExistentes(controlador.signal);
      }
      for (const nome of ['alunos', 'turmas', 'professores', 'ocupacao']) {
        document.getElementById(`indicador-${nome}`).textContent = dados[nome] == null
          ? '—' : `${formatador.format(dados[nome])}${nome === 'ocupacao' ? '%' : ''}`;
      }
      document.getElementById('ocupacaoDescricao').textContent = dados.vagas == null || dados.matriculas == null
        ? 'Ocupação indisponível'
        : dados.vagas === 0 ? 'Nenhuma vaga em turmas ativas'
        : `${formatador.format(dados.matriculas)} matrículas ativas / ${formatador.format(dados.vagas)} vagas em turmas ativas`;
      mensagem.textContent = dados.erros.length
        ? `Indicadores indisponíveis: ${dados.erros.join(', ')}. Verifique o backend e reinicie-o para carregar as rotas atualizadas.`
        : `Dados atualizados às ${new Date().toLocaleTimeString('pt-BR')}.`;
    } catch {
      for (const nome of ['alunos', 'turmas', 'professores', 'ocupacao']) {
        document.getElementById(`indicador-${nome}`).textContent = '—';
      }
      document.getElementById('ocupacaoDescricao').textContent = 'Ocupação indisponível';
      mensagem.textContent = 'Não foi possível carregar os indicadores. Verifique o servidor e clique em Atualizar.';
    } finally {
      clearTimeout(limite);
      carregando = false;
      atualizar.disabled = false;
    }
  }
  atualizar.addEventListener('click', carregarDashboard);
  window.addEventListener('pageshow', carregarDashboard);
  window.addEventListener('focus', carregarDashboard);
  carregarDashboard();
})();
