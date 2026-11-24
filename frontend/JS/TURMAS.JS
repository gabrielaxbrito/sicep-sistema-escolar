const API = 'http://localhost:3000';
const cardsContainer = document.getElementById('cardsContainer');
let todasTurmas = [];
const gradesRecolhidas = new Set();   // ids das turmas com as disciplinas escondidas
let cursosDisponiveis = [];

const filtroCurso = document.getElementById('filtroCurso');
const filtroProfessor = document.getElementById('filtroProfessor');
const filtroTurno = document.getElementById('filtroTurno');
const filtroBusca = document.getElementById('filtroBusca');
const mensagemTurmas = document.getElementById('mensagemTurmas');

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const porcento = v => (v === null || v === undefined) ? '—' : `${v}%`;
const aulasDe = t => Array.isArray(t.disciplinas) ? t.disciplinas : [];

// Turno pela primeira hora do horário (mesma regra da Grade Horária)
function turnoDe(horario) {
  const m = String(horario || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
}

function el(tag, classe, texto) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto !== undefined) n.textContent = texto;
  return n;
}
function dado(rotulo, valor, classe = '') {
  const d = el('div', classe);
  d.append(el('dt', '', rotulo), el('dd', '', valor));
  return d;
}

async function consultar(caminho, opcoes) {
  const resposta = await fetch(`${API}${caminho}`, opcoes);
  const dados = await resposta.json().catch(() => null);
  if (dados === null) throw new Error('O servidor não reconheceu esta rota. Reinicie o backend (npm run dev) para carregar a versão nova.');
  if (!resposta.ok) throw new Error(dados.error || 'Não foi possível concluir a operação.');
  return dados;
}
const enviar = (metodo, corpo) => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

// =========================
// LISTA, FILTROS E CARDS
// =========================

function turmasFiltradas() {
  const busca = semAcento(filtroBusca.value.trim());
  return todasTurmas.filter(t => {
    const aulas = aulasDe(t);
    return (!filtroCurso.value || String(t.curso_id) === filtroCurso.value) &&
      (!filtroProfessor.value || aulas.some(a => String(a.professor_id) === filtroProfessor.value)) &&
      (!filtroTurno.value || aulas.some(a => turnoDe(a.horario) === filtroTurno.value)) &&
      (!busca || semAcento(`${t.codigo} ${aulas.map(a => a.disciplina).join(' ')}`).includes(busca));
  });
}

function linhaGrade(a) {
  const li = el('li', 'turma-aula');
  li.append(el('strong', '', a.disciplina || 'Disciplina'));
  const partes = [a.professor || 'Professor não informado', a.horario || 'Horário não informado'];
  if (a.sala) partes.push(`Sala ${a.sala}`);
  li.append(el('span', '', partes.join(' · ')));
  return li;
}

function renderizarTurmas() {
  cardsContainer.replaceChildren();
  const turmas = turmasFiltradas();
  document.getElementById('totalTurmas').textContent = turmas.length;
  document.getElementById('totalProfessores').textContent =
    new Set(turmas.flatMap(t => aulasDe(t).map(a => a.professor_id)).filter(Boolean)).size;
  mensagemTurmas.textContent = turmas.length
    ? `${turmas.length} turma(s) encontrada(s).`
    : 'Nenhuma turma encontrada para estes filtros. Ajuste a busca ou clique em Nova turma.';

  turmas.forEach(turma => {
    const card = el('article', 'turma-card');
    const topo = el('div', 'turma-topo');
    const ativa = String(turma.status).toLowerCase() === 'ativa';
    topo.append(el('span', 'turma-codigo', turma.cursoNome || 'Curso'),
                el('span', `turma-selo ${ativa ? 'ativa' : 'encerrada'}`, ativa ? 'Ativa' : 'Encerrada'));

    const dl = el('dl', 'turma-dados');
    dl.append(
      dado('Vagas', `${turma.qtd_vagas_turmas ?? 0} (${turma.matriculados ?? 0} ocupadas · ${turma.vagas_livres ?? 0} livres)`, 'largo'),
      dado('Frequência da turma', turma.frequencia_percentual == null ? 'Sem aulas registradas' : `${turma.frequencia_percentual}% (${turma.frequencia_presentes} presenças em ${turma.frequencia_total} registros)`, 'largo'));

    const aulas = aulasDe(turma);
    const grade = el('div', 'turma-grade');
    const corpoGrade = el('div', 'turma-grade-corpo');
    if (aulas.length) { const ul = el('ul'); aulas.forEach(a => ul.append(linhaGrade(a))); corpoGrade.append(ul); }
    else corpoGrade.append(el('p', 'turma-grade-vazia', 'Nenhuma disciplina na grade. Clique em Grade para adicionar.'));

    // Botão + / − para mostrar ou esconder as disciplinas (o estado fica guardado entre filtros)
    const alternar = el('button', 'turma-grade-toggle');
    alternar.type = 'button';
    const aplicar = () => {
      const aberta = !gradesRecolhidas.has(turma.id);
      corpoGrade.hidden = !aberta;
      alternar.setAttribute('aria-expanded', aberta);
      alternar.title = aberta ? 'Esconder disciplinas' : 'Mostrar disciplinas';
      alternar.innerHTML = `<span>Disciplinas da turma (${aulas.length})</span><i class="fa-solid ${aberta ? 'fa-minus' : 'fa-plus'}" aria-hidden="true"></i>`;
    };
    alternar.addEventListener('click', () => {
      if (gradesRecolhidas.has(turma.id)) gradesRecolhidas.delete(turma.id); else gradesRecolhidas.add(turma.id);
      aplicar();
    });
    aplicar();
    grade.append(alternar, corpoGrade);

    const acoes = el('div', 'turma-acoes');
    const botao = (rotulo, icone, classe, aoClicar) => {
      const b = el('button', classe); b.type = 'button';
      b.innerHTML = `<i class="fa-solid ${icone} mr-2"></i>${rotulo}`;
      b.addEventListener('click', aoClicar); return b;
    };
    acoes.append(
      botao('Alunos', 'fa-user-graduate', 'editar', () => abrirAlunosTurma(turma)),
      botao('Presença', 'fa-clipboard-check', 'editar', () => abrirPresenca(turma)),
      botao('Grade', 'fa-table-list', 'editar', () => abrirModalTurma(turma.curso_id, turma, 'grade')),
      botao('Editar', 'fa-pen', 'editar', () => abrirModalTurma(turma.curso_id, turma, 'dados')),
      botao('Excluir', 'fa-trash', 'excluir', () => excluirTurma(turma.id)));

    card.append(topo, el('h3', '', turma.codigo || 'Sem código'), dl, grade, acoes);
    cardsContainer.append(card);
  });
}

function preencherProfessores() {
  const atual = filtroProfessor.value;
  const mapa = new Map();
  todasTurmas.forEach(t => aulasDe(t).forEach(a => { if (a.professor_id && a.professor) mapa.set(String(a.professor_id), a.professor); }));
  const itens = [...mapa].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  filtroProfessor.replaceChildren(new Option('Todos os professores', ''), ...itens.map(([id, nome]) => new Option(nome, id)));
  filtroProfessor.value = mapa.has(atual) ? atual : '';
}

async function carregarTurmas() {
  mensagemTurmas.textContent = 'Carregando turmas…';
  cardsContainer.replaceChildren();
  try {
    cursosDisponiveis = await consultar('/cursos');
    const grupos = await Promise.all(cursosDisponiveis.map(async curso => {
      const lista = await consultar(`/turmas/${encodeURIComponent(curso.id)}`);
      return lista.map(t => ({ ...t, curso_id: curso.id, cursoNome: curso.nome }));
    }));
    todasTurmas = grupos.flat();
    const selecionado = filtroCurso.value || new URLSearchParams(location.search).get('curso') || '';
    filtroCurso.replaceChildren(new Option('Todos os cursos', ''), ...cursosDisponiveis.map(c => new Option(c.nome, c.id)));
    filtroCurso.value = cursosDisponiveis.some(c => String(c.id) === selecionado) ? selecionado : '';
    preencherProfessores();
    renderizarTurmas();
    if (!cursosDisponiveis.length) mensagemTurmas.textContent = 'Cadastre um curso na página Cursos antes de criar turmas.';
  } catch (erro) {
    mensagemTurmas.textContent = erro.message || 'Não foi possível carregar as turmas. Verifique o servidor e tente novamente.';
    const tentar = el('button', 'border border-gray-300 rounded-lg px-4 py-3 bg-white', 'Tentar novamente');
    tentar.addEventListener('click', carregarTurmas);
    cardsContainer.append(tentar);
  }
}
[filtroCurso, filtroProfessor, filtroTurno].forEach(f => f.addEventListener('change', renderizarTurmas));
filtroBusca.addEventListener('input', renderizarTurmas);
document.getElementById('filtros').addEventListener('submit', e => e.preventDefault());
document.getElementById('novaTurmaBtn').addEventListener('click', () => abrirModalTurma(filtroCurso.value || cursosDisponiveis[0]?.id || ''));
carregarTurmas();

// =========================
// MODAL DA TURMA (2 abas)
// =========================

const modalTurma = document.getElementById('modalTurma');
const turmaForm = document.getElementById('turmaForm');
const turmaErro = document.getElementById('turmaErro');
const cursoIdInput = document.getElementById('curso_id');
const cursoNomeInput = document.getElementById('curso_nome');
const cursoStatus = document.getElementById('cursoStatus');
let turmaId = null;          // turma aberta no modal (null = ainda não salva)
let turmaAtual = null;
let turmaEmEdicao = false;   // true quando veio de Editar/Grade de uma turma existente

function aba(nome) {
  document.querySelectorAll('.aba-turma').forEach(b => {
    const ativa = b.dataset.aba === nome;
    const bloqueada = b.dataset.aba === 'grade' && turmaId === null;
    b.setAttribute('aria-selected', ativa);
    b.disabled = bloqueada;
    b.classList.toggle('text-[#07224f]', ativa);
    b.classList.toggle('border-[#07224f]', ativa);
    b.classList.toggle('text-gray-500', !ativa);
    b.classList.toggle('border-transparent', !ativa);
    b.classList.toggle('opacity-50', bloqueada);
    b.classList.toggle('cursor-not-allowed', bloqueada);
    b.title = bloqueada ? 'Salve os dados da turma primeiro' : '';
  });
  turmaForm.classList.toggle('hidden', nome !== 'dados');
  document.getElementById('painelGrade').classList.toggle('hidden', nome !== 'grade');
  document.getElementById('subtituloModalTurma').textContent = nome === 'dados'
    ? (turmaEmEdicao ? 'Altere os dados da turma' : 'Cadastre uma nova turma acadêmica')
    : `Disciplinas da turma ${turmaAtual?.codigo || ''}`.trim();
  if (nome === 'grade') iniciarGrade();
}
document.querySelectorAll('.aba-turma').forEach(b => b.addEventListener('click', () => { if (!b.disabled) aba(b.dataset.aba); }));

function abrirModalTurma(cursoId, turma = null, abaInicial = 'dados') {
  turmaForm.reset();
  turmaErro.textContent = '';
  turmaId = turma ? turma.id : null;
  turmaAtual = turma;
  turmaEmEdicao = !!turma;
  document.getElementById('tituloModalTurma').textContent = turma ? 'Editar turma' : 'Nova turma';
  turmaForm.querySelector('button[type="submit"]').textContent = turma ? 'Salvar alterações' : 'Salvar e continuar';
  cursoIdInput.value = cursoId;
  cursoIdInput.readOnly = !!turma;      // o curso não muda depois que a grade existe
  buscarCursoPorId(cursoId);
  if (turma) {
    document.getElementById('codigo').value = turma.codigo || '';
    document.getElementById('qtd_vagas_turmas').value = turma.qtd_vagas_turmas ?? '';
    document.getElementById('status').value = turma.status || 'ativa';
  }
  limparGrade();
  document.getElementById('gradeLista').replaceChildren();
  modalTurma.classList.remove('hidden');
  modalTurma.classList.add('flex');
  aba(abaInicial);
}

function fecharModalTurma() {
  modalTurma.classList.add('hidden');
  modalTurma.classList.remove('flex');
  turmaForm.reset();
  turmaId = null;
  carregarTurmas();
}
document.getElementById('closeTurmaModal').addEventListener('click', fecharModalTurma);
document.getElementById('cancelTurmaModal').addEventListener('click', fecharModalTurma);
document.getElementById('concluirTurma').addEventListener('click', fecharModalTurma);
modalTurma.addEventListener('click', e => { if (e.target === modalTurma) fecharModalTurma(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalTurma.classList.contains('hidden')) fecharModalTurma(); });

// ---- curso pelo código ----
async function buscarCursoPorId(id) {
  if (!id) { cursoNomeInput.value = ''; cursoStatus.textContent = ''; return; }
  try {
    const response = await fetch(`${API}/cursos/${id}`);
    if (!response.ok) {
      cursoNomeInput.value = '';
      cursoStatus.textContent = 'Curso não encontrado';
      cursoStatus.className = 'text-sm text-red-500';
      return;
    }
    const curso = await response.json();
    cursoNomeInput.value = curso.nome;
    cursoStatus.textContent = 'Curso encontrado ✓';
    cursoStatus.className = 'text-sm text-green-600';
  } catch (err) {
    cursoStatus.textContent = 'Erro ao buscar curso';
    cursoStatus.className = 'text-sm text-red-500';
  }
}
cursoIdInput.addEventListener('input', () => buscarCursoPorId(cursoIdInput.value.trim()));

// ---- aba 1: dados da turma ----
turmaForm.addEventListener('submit', async e => {
  e.preventDefault();
  turmaErro.textContent = '';
  if (!turmaForm.reportValidity()) return;
  const botao = turmaForm.querySelector('button[type="submit"]');
  botao.disabled = true;
  const corpo = {
    curso_id: Number(cursoIdInput.value),
    codigo: document.getElementById('codigo').value.trim(),
    qtd_vagas_turmas: Number(document.getElementById('qtd_vagas_turmas').value),
    status: document.getElementById('status').value
  };
  try {
    if (turmaId === null) {
      const criada = await consultar('/turmas', enviar('POST', corpo));
      const nova = Array.isArray(criada) ? criada[0] : criada;
      turmaId = nova.id;
      turmaAtual = { ...nova, ...corpo };
      aba('grade');                         // segue para a segunda aba
    } else {
      await consultar(`/turmas/${encodeURIComponent(turmaId)}`, enviar('PUT', corpo));
      turmaAtual = { ...turmaAtual, ...corpo };
      if (turmaEmEdicao) fecharModalTurma(); else aba('grade');
    }
  } catch (err) {
    turmaErro.textContent = err.message || 'Erro de conexão com o servidor';
  } finally {
    botao.disabled = false;
  }
});

// =========================
// ABA 2: GRADE DA TURMA
// =========================

const gradeForm = document.getElementById('gradeForm');
const gradeErro = document.getElementById('gradeErro');
const gradeDisciplina = document.getElementById('gradeDisciplina');
let linhaEditandoId = null;
let opcoesDisciplinas = [];

function turmaEncerrada() {
  return String(turmaAtual?.status || document.getElementById('status').value).toLowerCase() === 'encerrada';
}

function horarioDaGrade() {
  const dias = [...gradeForm.querySelectorAll('input[name="diaAula"]:checked')].map(i => i.value);
  const inicio = document.getElementById('horaInicio').value;
  const fim = document.getElementById('horaFim').value;
  if (turmaEncerrada() && !dias.length && !inicio && !fim) return { erro: '', valor: '' };
  const erro = !dias.length ? 'Selecione pelo menos um dia da semana.'
    : !inicio || !fim ? 'Informe o horário de início e de término.'
    : fim <= inicio ? 'O término deve ser posterior ao início, no mesmo dia.' : '';
  return { erro, valor: erro ? '' : `${dias.join(', ')} ${inicio} às ${fim}` };
}
function atualizarHorario() {
  const h = horarioDaGrade();
  document.getElementById('horarioErro').textContent = '';
  document.getElementById('horarioResumo').textContent = h.valor || (turmaEncerrada() ? 'Sem horário definido.' : 'Selecione os dias e informe um horário válido.');
}
gradeForm.addEventListener('input', atualizarHorario);
gradeForm.addEventListener('change', atualizarHorario);

function limparGrade() {
  linhaEditandoId = null;
  gradeForm.reset();
  gradeErro.textContent = '';
  document.getElementById('professor').value = '';
  document.getElementById('professorStatus').textContent = '';
  document.getElementById('gradeSalvar').textContent = 'Adicionar';
  document.getElementById('gradeCancelar').classList.add('hidden');
  atualizarHorario();
}
document.getElementById('gradeCancelar').addEventListener('click', () => { limparGrade(); gradeDisciplina.focus(); });

async function iniciarGrade() {
  await carregarOpcoesDisciplinas();
  await carregarGrade();
  gradeDisciplina.focus();
}

async function carregarOpcoesDisciplinas() {
  const status = document.getElementById('gradeDisciplinaStatus');
  status.textContent = 'Carregando disciplinas…';
  try {
    const lista = await consultar(`/cursos/${encodeURIComponent(turmaAtual.curso_id)}/disciplinas`);
    opcoesDisciplinas = lista.filter(d => String(d.status).toLowerCase() !== 'inativa');
    gradeDisciplina.replaceChildren(
      new Option(opcoesDisciplinas.length ? 'Selecione a disciplina' : 'Este curso não tem disciplinas', ''),
      ...opcoesDisciplinas.map(d => new Option(d.nome, d.id)));
    status.textContent = opcoesDisciplinas.length
      ? `${opcoesDisciplinas.length} disciplina(s) do curso.`
      : 'Cadastre as disciplinas deste curso na tela Cursos.';
  } catch (err) {
    gradeDisciplina.replaceChildren(new Option('Não foi possível carregar', ''));
    status.textContent = err.message;
  }
}

function lerHorarioSalvo(texto) {
  const m = String(texto || '').match(/^(.*?)\s*(\d{1,2}:\d{2})\s*às\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  return { dias: m[1].split(',').map(d => d.trim()), inicio: m[2].padStart(5, '0'), fim: m[3].padStart(5, '0') };
}

async function carregarGrade() {
  const lista = document.getElementById('gradeLista');
  lista.replaceChildren(el('li', 'p-4 text-sm text-gray-500', 'Carregando…'));
  try {
    const linhas = await consultar(`/turmas/${encodeURIComponent(turmaId)}/disciplinas`);
    lista.replaceChildren();
    if (!linhas.length) { lista.append(el('li', 'p-4 text-sm text-gray-500', 'Nenhuma disciplina adicionada ainda.')); return; }
    linhas.forEach(l => {
      const li = el('li', 'flex flex-wrap items-center justify-between gap-3 p-4');
      const info = el('div');
      info.append(el('p', 'font-medium text-gray-900', l.disciplina),
        el('p', 'text-xs text-gray-500', [l.professor || 'Professor não informado', l.horario || 'Sem horário', l.sala ? `Sala ${l.sala}` : null].filter(Boolean).join(' · ')));
      const acoes = el('div', 'flex gap-2');
      const editar = el('button', 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50', 'Editar'); editar.type = 'button';
      editar.addEventListener('click', () => editarLinha(l));
      const excluir = el('button', 'border border-red-200 text-red-600 rounded-lg px-3 py-1.5 text-sm hover:bg-red-50', 'Remover'); excluir.type = 'button';
      excluir.addEventListener('click', async () => {
        if (!confirm(`Remover "${l.disciplina}" da grade desta turma?`)) return;
        excluir.disabled = true;
        try {
          await consultar(`/turmas/${encodeURIComponent(turmaId)}/disciplinas/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
          if (linhaEditandoId === l.id) limparGrade();
          carregarGrade();
        } catch (err) { gradeErro.textContent = err.message; excluir.disabled = false; }
      });
      acoes.append(editar, excluir); li.append(info, acoes); lista.append(li);
    });
  } catch (err) {
    lista.replaceChildren(el('li', 'p-4 text-sm text-red-600', err.message));
  }
}

function editarLinha(l) {
  limparGrade();
  linhaEditandoId = l.id;
  gradeDisciplina.value = String(l.disciplina_id);
  document.getElementById('professor_id').value = l.professor_id ?? '';
  document.getElementById('professor').value = l.professor || '';
  document.getElementById('sala').value = l.sala || '';
  const h = lerHorarioSalvo(l.horario);
  if (h) {
    gradeForm.querySelectorAll('input[name="diaAula"]').forEach(i => { i.checked = h.dias.includes(i.value); });
    document.getElementById('horaInicio').value = h.inicio;
    document.getElementById('horaFim').value = h.fim;
  }
  atualizarHorario();
  document.getElementById('gradeSalvar').textContent = 'Salvar alterações';
  document.getElementById('gradeCancelar').classList.remove('hidden');
  gradeDisciplina.focus();
}

gradeForm.addEventListener('submit', async e => {
  e.preventDefault();
  gradeErro.textContent = '';
  if (!gradeDisciplina.value) { gradeErro.textContent = 'Selecione a disciplina.'; gradeDisciplina.focus(); return; }
  const horario = horarioDaGrade();
  if (horario.erro) { document.getElementById('horarioErro').textContent = horario.erro; return; }
  const botao = document.getElementById('gradeSalvar');
  botao.disabled = true;
  const corpo = {
    disciplina_id: Number(gradeDisciplina.value),
    professor_id: document.getElementById('professor_id').value === '' ? null : Number(document.getElementById('professor_id').value),
    horario: horario.valor,
    sala: document.getElementById('sala').value.trim()
  };
  try {
    const base = `/turmas/${encodeURIComponent(turmaId)}/disciplinas`;
    if (linhaEditandoId === null) await consultar(base, enviar('POST', corpo));
    else await consultar(`${base}/${encodeURIComponent(linhaEditandoId)}`, enviar('PUT', corpo));
    limparGrade();
    await carregarGrade();
    gradeDisciplina.focus();
  } catch (err) {
    gradeErro.textContent = err.message || 'Erro de conexão com o servidor';
  } finally {
    botao.disabled = false;
  }
});

// ---- professor pelo código ----
const professorIdInput = document.getElementById('professor_id');
const professorNomeInput = document.getElementById('professor');
const professorStatus = document.getElementById('professorStatus');

async function buscarProfessorPorId(id) {
  if (!id) { professorNomeInput.value = ''; professorStatus.textContent = ''; return; }
  try {
    const response = await fetch(`${API}/professores/${id}`);
    if (!response.ok) {
      professorNomeInput.value = '';
      professorStatus.textContent = 'Professor não encontrado';
      professorStatus.className = 'text-sm text-red-500';
      return;
    }
    // A rota devolve { professor: {...}, turmas: [...] } (aceita também o formato antigo)
    const dados = await response.json();
    const professor = dados.professor ?? dados;
    if (!professor || !professor.nome) {
      professorNomeInput.value = '';
      professorStatus.textContent = 'Professor não encontrado';
      professorStatus.className = 'text-sm text-red-500';
      return;
    }
    professorNomeInput.value = professor.nome;
    professorStatus.textContent = 'Professor encontrado ✓';
    professorStatus.className = 'text-sm text-green-600';
  } catch (err) {
    professorStatus.textContent = 'Erro ao buscar professor';
    professorStatus.className = 'text-sm text-red-500';
  }
}
professorIdInput.addEventListener('input', () => buscarProfessorPorId(professorIdInput.value.trim()));

// =========================
// EXCLUIR TURMA
// =========================

async function excluirTurma(id) {
  if (!confirm('Deseja excluir esta turma e toda a sua grade de disciplinas?')) return;
  try {
    await consultar(`/turmas/${encodeURIComponent(id)}`, { method: 'DELETE' });
    carregarTurmas();
  } catch (err) {
    alert(err.message || 'Erro de conexão com o servidor');
  }
}

// =========================
// ALUNOS DA TURMA (vagas e frequência)
// =========================

const modalAlunosTurma = document.getElementById('modalAlunosTurma');

let alunosTurmaDados = null;

function renderAlunosTurma() {
  const dados = alunosTurmaDados;
  if (!dados) return;
  const termo = document.getElementById('atBusca').value.trim().toLowerCase();
  const dia = document.getElementById('atData').value;
  document.getElementById('atLimpar').classList.toggle('hidden', !termo && !dia);

  // Frequência de cada aluno: da turma toda ou só do dia escolhido
  const linhasAlunos = dados.alunos.map(a => {
    if (!dia) return { ...a, f: a.frequencia, registradoNoDia: true };
    const doDia = (a.registros || []).filter(r => r.data === dia);
    const presentes = doDia.filter(r => r.presente).length;
    const total = doDia.length;
    return { ...a, registradoNoDia: total > 0,
      f: { presentes, faltas: total - presentes, total_aulas: total, percentual: total ? Math.round((presentes / total) * 100) : null } };
  });

  const visiveis = linhasAlunos.filter(a => !termo || `${a.nome} ${a.email || ''}`.toLowerCase().includes(termo));

  const fr = dados.frequencia;
  const el = document.getElementById('atAulas');
  if (dia) {
    const comRegistro = linhasAlunos.filter(a => a.registradoNoDia);
    el.textContent = comRegistro.length
      ? `Aula de ${dataBR(dia)} · ${comRegistro.reduce((t, a) => t + a.f.presentes, 0)} presenças e ${comRegistro.reduce((t, a) => t + a.f.faltas, 0)} faltas.`
      : `Nenhuma presença lançada em ${dataBR(dia)}.`;
  } else {
    el.textContent = fr.total_aulas
      ? `${fr.aulas_lancadas} aula(s) lançada(s) · ${fr.presentes} presenças e ${fr.faltas} faltas no total.`
      : 'Nenhuma aula registrada para esta turma ainda.';
  }

  document.getElementById('atLinhas').innerHTML = visiveis.length
    ? visiveis.map(a => {
        const ativa = String(a.status).toLowerCase() === 'ativa';
        const semRegistro = dia && !a.registradoNoDia;
        return `<tr class="border-t border-gray-100">
          <td class="px-4 py-3"><p class="font-medium">${escapar(a.nome)}</p><p class="text-xs text-gray-500">${escapar(a.email || '')}</p></td>
          <td class="px-4 py-3 text-center"><span class="text-xs font-semibold px-2.5 py-1 rounded-full ${ativa ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}">${ativa ? 'Ativa' : escapar(a.status || '—')}</span></td>
          <td class="px-4 py-3 text-center">${semRegistro ? '—' : a.f.presentes}</td>
          <td class="px-4 py-3 text-center">${semRegistro ? '—' : a.f.faltas}</td>
          <td class="px-4 py-3 text-center font-semibold">${semRegistro ? '—' : porcento(a.f.percentual)}</td></tr>`;
      }).join('')
    : `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">${dados.alunos.length ? 'Nenhum aluno encontrado com esses filtros.' : 'Nenhum aluno matriculado nesta turma.'}</td></tr>`;
}

document.getElementById('atBusca').addEventListener('input', renderAlunosTurma);
document.getElementById('atData').addEventListener('change', renderAlunosTurma);
document.getElementById('atLimpar').addEventListener('click', () => {
  document.getElementById('atBusca').value = '';
  document.getElementById('atData').value = '';
  renderAlunosTurma();
});

async function abrirAlunosTurma(turma) {
  document.getElementById('alunosTurmaTitulo').textContent = turma.codigo || 'Turma';
  document.getElementById('alunosTurmaSub').textContent = [turma.cursoNome, aulasDe(turma).map(a => a.disciplina).join(', ')].filter(Boolean).join(' • ');
  document.getElementById('alunosTurmaCarregando').classList.remove('hidden');
  document.getElementById('alunosTurmaErro').classList.add('hidden');
  document.getElementById('alunosTurmaConteudo').classList.add('hidden');
  modalAlunosTurma.classList.remove('hidden');
  modalAlunosTurma.classList.add('flex');
  try {
    const dados = await consultar(`/turmas/${encodeURIComponent(turma.id)}/resumo`);
    document.getElementById('atVagas').textContent = dados.vagas.total;
    document.getElementById('atOcupadas').textContent = dados.vagas.ocupadas;
    document.getElementById('atLivres').textContent = dados.vagas.livres;
    document.getElementById('atFreq').textContent = porcento(dados.frequencia.percentual);
    alunosTurmaDados = dados;
    document.getElementById('atBusca').value = '';
    document.getElementById('atData').value = '';
    renderAlunosTurma();
    document.getElementById('alunosTurmaConteudo').classList.remove('hidden');
  } catch (err) {
    const e = document.getElementById('alunosTurmaErro');
    e.textContent = err.message || 'Erro de conexão com o servidor.';
    e.classList.remove('hidden');
  } finally {
    document.getElementById('alunosTurmaCarregando').classList.add('hidden');
  }
}

function fecharAlunosTurma() {
  modalAlunosTurma.classList.add('hidden');
  modalAlunosTurma.classList.remove('flex');
}
document.getElementById('closeAlunosTurma').addEventListener('click', fecharAlunosTurma);
modalAlunosTurma.addEventListener('click', e => { if (e.target === modalAlunosTurma) fecharAlunosTurma(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharAlunosTurma(); });


// =========================
// PRESENÇA (chamada por disciplina e data)
// =========================

const modalPresenca = document.getElementById('modalPresenca');
const presencaDisciplina = document.getElementById('presencaDisciplina');
const presencaData = document.getElementById('presencaData');
const presencaErro = document.getElementById('presencaErro');
const presencaAviso = document.getElementById('presencaAviso');
let turmaPresenca = null;
let alunosPresenca = [];     // [{ matricula_id, nome, presente }]
let buscaPresenca = 0;

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dataBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };

function limparAula() {
  document.getElementById('presencaTituloAula').value = '';
  document.getElementById('presencaConteudoAula').value = '';
  avisoAula('');
}

function avisoAula(texto) {
  const e = document.getElementById('presencaAulaAviso');
  e.textContent = texto;
  e.classList.toggle('hidden', !texto);
}

function mostrarConteudoPresenca(visivel) {
  if (!visivel) document.getElementById('presencaSalvar').disabled = true;
  document.getElementById('presencaConteudo').classList.toggle('hidden', !visivel);
}

function atualizarContagemPresenca() {
  const presentes = alunosPresenca.filter(a => a.presente).length;
  document.getElementById('presencaContagem').textContent =
    `${presentes} presente(s) e ${alunosPresenca.length - presentes} falta(s) de ${alunosPresenca.length} aluno(s).`;
}

function desenharListaPresenca() {
  const lista = document.getElementById('presencaLista');
  const termo = document.getElementById('presencaBusca').value.trim().toLowerCase();
  lista.replaceChildren();
  const visiveis = alunosPresenca.filter(a => !termo || a.nome.toLowerCase().includes(termo));
  if (!visiveis.length) {
    const tr = el('tr', '');
    const td = el('td', 'px-4 py-8 text-center text-gray-500', 'Nenhum aluno encontrado.');
    td.colSpan = 2;
    tr.append(td);
    lista.append(tr);
  }
  visiveis.forEach(a => {
    const tr = el('tr', 'border-t border-gray-100');
    tr.append(el('td', 'px-4 py-3 font-medium text-gray-900', a.nome));
    const td = el('td', 'px-4 py-3 text-center');
    const rotulo = el('label', 'presenca-chave');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = a.presente;
    caixa.setAttribute('aria-label', `Presença de ${a.nome}`);
    const texto = el('span', '', a.presente ? 'Presente' : 'Falta');
    texto.className = a.presente ? 'presenca-sim' : 'presenca-nao';
    caixa.addEventListener('change', () => {
      a.presente = caixa.checked;
      texto.textContent = a.presente ? 'Presente' : 'Falta';
      texto.className = a.presente ? 'presenca-sim' : 'presenca-nao';
      atualizarContagemPresenca();
    });
    rotulo.append(caixa, texto);
    td.append(rotulo);
    tr.append(td);
    lista.append(tr);
  });
  atualizarContagemPresenca();
}

async function carregarChamada() {
  const busca = ++buscaPresenca;
  presencaErro.textContent = '';
  presencaAviso.classList.add('hidden');
  mostrarConteudoPresenca(false);
  limparAula();
  const tdId = presencaDisciplina.value;
  if (!tdId || !presencaData.value) return;
  document.getElementById('presencaCarregando').classList.remove('hidden');
  try {
    const dados = await consultar(`/turmas/${encodeURIComponent(turmaPresenca.id)}/presenca?turma_disciplina_id=${encodeURIComponent(tdId)}&data=${encodeURIComponent(presencaData.value)}`);
    if (busca !== buscaPresenca) return;
    // Quem ainda não tem registro começa como presente
    alunosPresenca = dados.alunos.map(a => ({ matricula_id: a.matricula_id, nome: a.nome, presente: a.presente === null ? true : a.presente }));
    document.getElementById('presencaTituloAula').value = dados.aula?.titulo || '';
    document.getElementById('presencaConteudoAula').value = dados.aula?.conteudo || '';
    avisoAula(dados.aula_disponivel === false ? 'O registro de título e conteúdo ainda não está disponível: crie a tabela "aulas" (sql/aulas.sql).' : '');
    document.getElementById('presencaBusca').value = '';
    if (!alunosPresenca.length) {
      presencaErro.textContent = 'Esta turma não tem alunos com matrícula ativa.';
      return;
    }
    if (dados.lancada) {
      presencaAviso.textContent = `A chamada de ${dataBR(dados.data)} já foi lançada. Você está editando o que foi salvo.`;
      presencaAviso.classList.remove('hidden');
    }
    desenharListaPresenca();
    document.getElementById('presencaSalvar').disabled = String(turmaPresenca.status).toLowerCase() !== 'ativa';
    mostrarConteudoPresenca(true);
  } catch (err) {
    if (busca === buscaPresenca) presencaErro.textContent = err.message;
  } finally {
    if (busca === buscaPresenca) document.getElementById('presencaCarregando').classList.add('hidden');
  }
}

function abrirPresenca(turma) {
  turmaPresenca = turma;
  document.getElementById('presencaTitulo').textContent = turma.codigo || 'Turma';
  document.getElementById('presencaSub').textContent = turma.cursoNome || '';
  presencaErro.textContent = '';
  presencaAviso.classList.add('hidden');
  mostrarConteudoPresenca(false);
  limparAula();
  const linhas = aulasDe(turma).filter(a => a.id);
  presencaDisciplina.replaceChildren(...(linhas.length
    ? [new Option('Selecione a disciplina', ''), ...linhas.map(a => new Option(a.disciplina + (a.horario ? ` — ${a.horario}` : ''), a.id))]
    : [new Option('Esta turma não tem disciplinas na grade', '')]));
  if (linhas.length === 1) presencaDisciplina.value = String(linhas[0].id);
  presencaData.max = hojeISO();
  presencaData.value = hojeISO();
  modalPresenca.classList.remove('hidden');
  modalPresenca.classList.add('flex');
  if (!linhas.length) presencaErro.textContent = 'Adicione as disciplinas na Grade da turma antes de lançar presença.';
  else if (String(turma.status).toLowerCase() !== 'ativa') presencaErro.textContent = 'Esta turma está encerrada: você pode consultar as chamadas, mas não lançar novas.';
  carregarChamada();
}

function fecharPresenca() {
  modalPresenca.classList.add('hidden');
  modalPresenca.classList.remove('flex');
  turmaPresenca = null;
  carregarTurmas();   // atualiza os percentuais de frequência nos cards
}

presencaDisciplina.addEventListener('change', carregarChamada);
document.getElementById('presencaBusca').addEventListener('input', desenharListaPresenca);
presencaData.addEventListener('change', () => {
  if (presencaData.value > hojeISO()) { presencaErro.textContent = 'Não é possível lançar presença em data futura.'; mostrarConteudoPresenca(false); return; }
  carregarChamada();
});
document.getElementById('presencaTodos').addEventListener('click', () => { alunosPresenca.forEach(a => { a.presente = true; }); desenharListaPresenca(); });
document.getElementById('presencaNenhum').addEventListener('click', () => { alunosPresenca.forEach(a => { a.presente = false; }); desenharListaPresenca(); });
document.getElementById('closePresenca').addEventListener('click', fecharPresenca);
document.getElementById('presencaCancelar').addEventListener('click', fecharPresenca);
modalPresenca.addEventListener('click', e => { if (e.target === modalPresenca) fecharPresenca(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalPresenca.classList.contains('hidden')) fecharPresenca(); });

document.getElementById('presencaSalvar').addEventListener('click', async () => {
  const botao = document.getElementById('presencaSalvar');
  botao.disabled = true;
  presencaErro.textContent = '';
  try {
    const r = await consultar(`/turmas/${encodeURIComponent(turmaPresenca.id)}/presenca`, enviar('POST', {
      turma_disciplina_id: Number(presencaDisciplina.value),
      data: presencaData.value,
      titulo: document.getElementById('presencaTituloAula').value,
      conteudo: document.getElementById('presencaConteudoAula').value,
      registros: alunosPresenca.map(a => ({ matricula_id: a.matricula_id, presente: a.presente }))
    }));
    const disciplinaNome = presencaDisciplina.options[presencaDisciplina.selectedIndex]?.text.split(' — ')[0] || '';
    const titulo = document.getElementById('presencaTituloAula').value.trim();
    const resumo = [turmaPresenca.codigo, disciplinaNome, dataBR(presencaData.value)].filter(Boolean).join(' · ') + (titulo ? ` — ${titulo}` : '');
    fecharPresenca();
    abrirConfirmacaoPresenca({ resumo, presentes: r.presentes, faltas: r.faltas, aviso: r.aviso || '' });
  } catch (err) {
    presencaErro.textContent = err.message;
  } finally {
    botao.disabled = !turmaPresenca || String(turmaPresenca.status).toLowerCase() !== 'ativa';
  }
});

// Confirmação depois de salvar a presença
const modalPresencaOk = document.getElementById('modalPresencaOk');

function abrirConfirmacaoPresenca({ resumo, presentes, faltas, aviso }) {
  document.getElementById('presencaOkResumo').textContent = resumo;
  document.getElementById('presencaOkPresentes').textContent = presentes;
  document.getElementById('presencaOkFaltas').textContent = faltas;
  const a = document.getElementById('presencaOkAviso');
  a.textContent = aviso;
  a.classList.toggle('hidden', !aviso);
  modalPresencaOk.classList.remove('hidden');
  modalPresencaOk.classList.add('flex');
  document.getElementById('presencaOkFechar').focus();
}

function fecharConfirmacaoPresenca() {
  modalPresencaOk.classList.add('hidden');
  modalPresencaOk.classList.remove('flex');
}
document.getElementById('presencaOkFechar').addEventListener('click', fecharConfirmacaoPresenca);
modalPresencaOk.addEventListener('click', e => { if (e.target === modalPresencaOk) fecharConfirmacaoPresenca(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalPresencaOk.classList.contains('hidden')) fecharConfirmacaoPresenca(); });
