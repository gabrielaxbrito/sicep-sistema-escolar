const API = 'http://localhost:3000';
const cardsContainer = document.getElementById('cardsContainer');
let todasTurmas = [];
let cursosDisponiveis = [];
const filtroCurso = document.getElementById('filtroCurso');
const mensagemTurmas = document.getElementById('mensagemTurmas');
function renderizarTurmas() {
  cardsContainer.replaceChildren();
  const turmas = todasTurmas.filter(t => !filtroCurso.value || String(t.curso_id) === filtroCurso.value);
  mensagemTurmas.textContent = `${turmas.length} turma(s) encontrada(s).`;
  if (!turmas.length) {
    mensagemTurmas.textContent = 'Nenhuma turma cadastrada para este filtro. Clique em Nova turma para cadastrar.';
  }
  turmas.forEach(turma => {
    const card = document.createElement('article');
    card.className = 'bg-white border border-gray-200 rounded-2xl p-6';
    const titulo = document.createElement('h3');
    titulo.className = 'text-xl font-semibold mb-2';
    titulo.textContent = `${turma.codigo || 'Sem código'} — ${turma.disciplina || 'Sem disciplina'}`;
    const detalhes = document.createElement('p');
    detalhes.className = 'text-sm text-gray-500 leading-7';
    detalhes.textContent = `${turma.cursoNome} • ${turma.professor || 'Professor não informado'} • ${turma.horario || 'Horário não informado'} • Sala: ${turma.sala || 'Não informada'} • ${turma.qtd_vagas_turmas || 0} vagas • ${turma.status === 'ativa' ? 'Ativa' : 'Encerrada'}`;
    const excluir = document.createElement('button');
    excluir.className = 'mt-4 text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50';
    excluir.textContent = 'Excluir turma';
    excluir.addEventListener('click', () => excluirTurma(turma.id));
    card.append(titulo, detalhes, excluir);
    cardsContainer.append(card);
  });
}
async function carregarTurmas() {
  mensagemTurmas.textContent = 'Carregando turmas…';
  cardsContainer.replaceChildren();
  const botao = document.getElementById('novaTurmaBtn');
  botao.disabled = false;
  try {
    const resposta = await fetch(`${API}/cursos`);
    if (!resposta.ok) throw new Error('Erro ao carregar cursos');
    cursosDisponiveis = await resposta.json();
    const grupos = await Promise.all(cursosDisponiveis.map(async curso => {
      const res = await fetch(`${API}/turmas/${encodeURIComponent(curso.id)}`);
      if (!res.ok) throw new Error('Erro ao carregar turmas');
      return (await res.json()).map(t => ({ ...t, curso_id: curso.id, cursoNome: curso.nome }));
    }));
    todasTurmas = grupos.flat();
    const selecionado = filtroCurso.value || new URLSearchParams(location.search).get('curso') || '';
    filtroCurso.replaceChildren(new Option('Todos os cursos', ''), ...cursosDisponiveis.map(c => new Option(c.nome, c.id)));
    filtroCurso.value = cursosDisponiveis.some(c => String(c.id) === selecionado) ? selecionado : '';
    renderizarTurmas();
    if (!cursosDisponiveis.length) mensagemTurmas.textContent = 'Cadastre um curso na página Cursos antes de criar turmas.';
    botao.disabled = false;
  } catch (erro) {
    mensagemTurmas.textContent = 'Não foi possível carregar as turmas. Verifique o servidor e tente novamente.';
    const tentar = document.createElement('button');
    tentar.textContent = 'Tentar novamente';
    tentar.className = 'border border-gray-300 rounded-lg px-4 py-3 bg-white';
    tentar.addEventListener('click', carregarTurmas);
    cardsContainer.append(tentar);
  }
}
filtroCurso.addEventListener('change', renderizarTurmas);
document.getElementById('novaTurmaBtn').addEventListener('click', () => abrirModalTurma(filtroCurso.value || cursosDisponiveis[0]?.id || ''));
document.addEventListener('keydown', evento => { if (evento.key === 'Escape') fecharModalTurma(); });
carregarTurmas();

const modalTurma      = document.getElementById("modalTurma")
const turmaForm       = document.getElementById("turmaForm")
const closeTurmaModal = document.getElementById("closeTurmaModal")
const cancelTurmaModal= document.getElementById("cancelTurmaModal")

function horarioTurma() {
  const dias = [...turmaForm.querySelectorAll('input[name="diaAula"]:checked')].map(input => input.value);
  const inicio = document.getElementById('horaInicio').value;
  const fim = document.getElementById('horaFim').value;
  const erro = !dias.length ? 'Selecione pelo menos um dia da semana.'
    : !inicio || !fim ? 'Informe o horário de início e de término.'
    : fim <= inicio ? 'O término deve ser posterior ao início, no mesmo dia.' : '';
  return { erro, valor: erro ? '' : `${dias.join(', ')} ${inicio} às ${fim}` };
}
function atualizarHorario() {
  const horario = horarioTurma();
  document.getElementById('horaFim').setCustomValidity('');
  document.getElementById('horarioErro').textContent = '';
  document.getElementById('horarioResumo').textContent = horario.valor || 'Selecione os dias e informe um horário válido.';
}
turmaForm.addEventListener('input', atualizarHorario);
turmaForm.addEventListener('reset', () => {
  document.getElementById('horaFim').setCustomValidity('');
  document.getElementById('horarioErro').textContent = '';
  document.getElementById('horarioResumo').textContent = 'Selecione os dias e informe o horário.';
});

function abrirModalTurma(cursoId) {
  document.getElementById("curso_id").value = cursoId
  turmaForm.reset()
  buscarCursoPorId(cursoId)
  document.getElementById("curso_id").value = cursoId
  modalTurma.classList.remove("hidden")
  modalTurma.classList.add("flex")
}

function fecharModalTurma() {
  modalTurma.classList.add("hidden")
  modalTurma.classList.remove("flex")
  turmaForm.reset()
}

closeTurmaModal.addEventListener("click", fecharModalTurma)
cancelTurmaModal.addEventListener("click", fecharModalTurma)

// =========================
// CRIAR TURMA
// =========================

turmaForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  const horario = horarioTurma();
  if (horario.erro) {
    document.getElementById('horarioErro').textContent = horario.erro;
    const primeiroDia = turmaForm.querySelector('input[name="diaAula"]:checked');
    if (!primeiroDia) turmaForm.querySelector('input[name="diaAula"]').focus();
    else {
      document.getElementById('horaFim').setCustomValidity(horario.erro);
      document.getElementById('horaFim').reportValidity();
    }
    return;
  }
  if (!turmaForm.reportValidity()) return;

  const submitBtn = turmaForm.querySelector('button[type="submit"]')
  submitBtn.disabled = true
  submitBtn.textContent = "Salvando..."

  const turma = {
    curso_id:        Number(document.getElementById("curso_id").value),
    codigo:          document.getElementById("codigo").value,
    disciplina:      document.getElementById("disciplina").value,
    professor_id:    Number(document.getElementById("professor_id").value),
    horario:         horario.valor,
    sala:            document.getElementById("sala").value,
    qtd_vagas_turmas:Number(document.getElementById("qtd_vagas_turmas").value),
    status:          document.getElementById("status").value
  }

  try {
    const response = await fetch(`${API}/turmas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(turma)
    })

    const data = await response.json()

    if (!response.ok) {
      alert(data.error || "Erro ao criar turma")
      return
    }

    fecharModalTurma()
    carregarTurmas()

  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = "Criar turma"
  }
})

// =========================
// EXCLUIR TURMA
// =========================

async function excluirTurma(id) {
  const confirmar = confirm("Deseja excluir esta turma?")
  if (!confirmar) return

  try {
    const response = await fetch(`${API}/turmas/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json()
      alert(data.error || "Erro ao excluir turma")
      return
    }
    carregarTurmas()
  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  }
}


const idProfessorInput = document.getElementById("professor_id")
const professorInput   = document.getElementById("professor")
const professorStatus  = document.getElementById("professorStatus")

let professorTimer = null

idProfessorInput.addEventListener("input", () => {
  clearTimeout(professorTimer)
  const id = idProfessorInput.value.trim()

  if (!id) {
    professorInput.value     = ""
    professorStatus.textContent = ""
    return
  }

  professorTimer = setTimeout(async () => {
    try {
      const response = await fetch(`${API}/professores/${id}`)

      if (!response.ok) {
        professorInput.value        = ""
        professorStatus.textContent = "Professor não encontrado"
        professorStatus.className   = "text-sm text-red-500"
        return
      }

      const professor = await response.json()
      professorInput.value        = professor.nome
      professorStatus.textContent = "Professor encontrado ✓"
      professorStatus.className   = "text-sm text-green-600"

    } catch (err) {
      professorStatus.textContent = "Erro ao buscar professor"
      professorStatus.className   = "text-sm text-red-500"
    }
  }, 400)
})

// =========================
// BUSCAR CURSO POR ID
// =========================

const cursoIdInput  = document.getElementById("curso_id")
const cursoNomeInput= document.getElementById("curso_nome")
const cursoStatus   = document.getElementById("cursoStatus")

async function buscarCursoPorId(id) {
  if (!id) {
    cursoNomeInput.value      = ""
    cursoStatus.textContent   = ""
    return
  }

  try {
    const response = await fetch(`${API}/cursos/${id}`)

    if (!response.ok) {
      cursoNomeInput.value      = ""
      cursoStatus.textContent   = "Curso não encontrado"
      cursoStatus.className     = "text-sm text-red-500"
      return
    }

    const curso = await response.json()
    cursoNomeInput.value      = curso.nome
    cursoStatus.textContent   = "Curso encontrado ✓"
    cursoStatus.className     = "text-sm text-green-600"

  } catch (err) {
    cursoStatus.textContent = "Erro ao buscar curso"
    cursoStatus.className   = "text-sm text-red-500"
  }
}

cursoIdInput.addEventListener("input", () => buscarCursoPorId(cursoIdInput.value.trim()))

