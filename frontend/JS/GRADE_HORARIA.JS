(() => {
  'use strict';
  const API = 'http://localhost:3000';
  const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  const abreviacoes = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const el = id => document.getElementById(id);
  const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let turmas = [];
  function diasDoHorario(horario) {
    const texto = normalizar(horario);
    return abreviacoes.map((dia, indice) => new RegExp(`\\b${dia}[a-z]*\\b`).test(texto) ? indice : -1).filter(indice => indice >= 0);
  }
  function horaInicial(horario) {
    const resultado = String(horario || '').match(/\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?/i);
    return resultado ? Number(resultado[1]) * 60 + Number(resultado[2] || 0) : null;
  }
  function turno(horario) {
    const minutos = horaInicial(horario);
    return minutos === null ? '' : minutos < 720 ? 'manha' : minutos < 1080 ? 'tarde' : 'noite';
  }
  function texto(tag, conteudo, classe) {
    const elemento = document.createElement(tag);
    elemento.textContent = conteudo;
    if (classe) elemento.className = classe;
    return elemento;
  }
  function cartao(turma) {
    const card = document.createElement('article');
    card.className = 'lesson';
    card.append(texto('p', turma.horario || 'Horário não informado', 'time'),
      texto('strong', turma.disciplina || 'Disciplina não informada'),
      texto('p', turma.cursoNome), texto('p', `Turma: ${turma.codigo || 'Sem código'}`),
      texto('p', turma.professor || 'Professor não informado'));
    if (turma.sala) card.append(texto('p', `Sala: ${turma.sala}`));
    return card;
  }
  function renderizar() {
    const busca = normalizar(el('busca').value.trim());
    const filtradas = turmas.filter(turma =>
      (!el('curso').value || String(turma.curso_id) === el('curso').value) &&
      (!el('professor').value || turma.professor === el('professor').value) &&
      (!el('turno').value || turno(turma.horario) === el('turno').value) &&
      (!busca || normalizar(`${turma.disciplina || ''} ${turma.codigo || ''}`).includes(busca))
    ).sort((a, b) => (horaInicial(a.horario) ?? 1440) - (horaInicial(b.horario) ?? 1440));
    el('totalTurmas').textContent = filtradas.length;
    el('totalProfessores').textContent = new Set(filtradas.map(t => t.professor_id || t.professor).filter(Boolean)).size;
    el('totalDias').textContent = new Set(filtradas.flatMap(t => diasDoHorario(t.horario))).size;
    el('grade').replaceChildren();
    dias.forEach((dia, indice) => {
      const coluna = document.createElement('section');
      coluna.className = 'day';
      coluna.append(texto('h3', dia));
      const conteudo = document.createElement('div');
      conteudo.className = 'day-content';
      const aulas = filtradas.filter(t => diasDoHorario(t.horario).includes(indice));
      conteudo.append(...(aulas.length ? aulas.map(cartao) : [texto('p', 'Sem aulas', 'no-lessons')]));
      coluna.append(conteudo);
      el('grade').append(coluna);
    });
    const pendentes = filtradas.filter(t => !diasDoHorario(t.horario).length);
    el('pendentes').classList.toggle('hidden', !pendentes.length);
    el('listaPendentes').replaceChildren(...pendentes.map(cartao));
    el('estado').textContent = filtradas.length ? `${filtradas.length} turma(s) na grade • Semana recorrente` : 'Nenhuma turma encontrada. Ajuste os filtros ou cadastre turmas em Turmas.';
  }
  async function buscar(caminho) {
    const resposta = await fetch(`${API}${caminho}`, { signal: AbortSignal.timeout(15000) });
    if (!resposta.ok) throw new Error('Erro ao consultar dados');
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error('Resposta inválida');
    return dados;
  }
  async function carregar() {
    el('atualizar').disabled = true;
    el('imprimir').disabled = true;
    el('filtros').inert = true;
    el('erro').classList.add('hidden');
    el('estado').textContent = 'Carregando grade horária…';
    try {
      const cursos = await buscar('/cursos');
      const grupos = await Promise.all(cursos.map(async curso => {
        const dados = await buscar(`/turmas/${encodeURIComponent(curso.id)}`);
        return dados.map(t => ({ ...t, curso_id: curso.id, cursoNome: curso.nome }));
      }));
      turmas = grupos.flat();
      const cursoSelecionado = el('curso').value;
      const professorSelecionado = el('professor').value;
      el('curso').replaceChildren(new Option('Todos os cursos', ''), ...cursos.map(c => new Option(c.nome, c.id)));
      const professores = [...new Set(turmas.map(t => t.professor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      el('professor').replaceChildren(new Option('Todos os professores', ''), ...professores.map(p => new Option(p, p)));
      el('curso').value = cursos.some(c => String(c.id) === cursoSelecionado) ? cursoSelecionado : '';
      el('professor').value = professores.includes(professorSelecionado) ? professorSelecionado : '';
      renderizar();
      el('imprimir').disabled = false;
    } catch (erro) {
      turmas = [];
      el('grade').replaceChildren();
      el('pendentes').classList.add('hidden');
      ['totalTurmas', 'totalProfessores', 'totalDias'].forEach(id => { el(id).textContent = '—'; });
      el('estado').textContent = 'Grade indisponível.';
      el('erro').classList.remove('hidden');
    } finally {
      el('atualizar').disabled = false;
      el('filtros').inert = false;
    }
  }
  el('filtros').addEventListener('submit', evento => evento.preventDefault());
  el('filtros').addEventListener('input', renderizar);
  el('atualizar').addEventListener('click', carregar);
  el('imprimir').addEventListener('click', () => window.print());
  carregar();
})();
