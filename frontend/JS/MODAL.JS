// Gerencia os formulários de cursos e turmas pela API.
const API = window.SICEP_API_URL

// =========================
// ELEMENTOS - CURSO
// =========================

const modal          = document.getElementById("modal")
const closeModalBtn  = document.getElementById("closeModal")
const cancelModalBtn = document.getElementById("cancelModal")
const cursoForm      = document.getElementById("cursoForm")
const cardsContainer = document.getElementById("cardsContainer")
const novoCursoBtn   = document.querySelector("#novoCursoBtn")

// =========================
// ELEMENTOS - TURMA
// =========================

const modalTurma      = document.getElementById("modalTurma")
const turmaForm       = document.getElementById("turmaForm")
const closeTurmaModal = document.getElementById("closeTurmaModal")
const cancelTurmaModal= document.getElementById("cancelTurmaModal")

// =========================
// CONTROLE DE EDIÇÃO
// =========================

let editandoId = null

const professorCurso = document.getElementById('curso_professor')
const diasCurso = () => [...cursoForm.querySelectorAll('input[name="semana"]:checked')].map(input => input.value)
const escaparCurso = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function carregarProfessoresCurso(selecionado = '') {
  const professores = window.previaUsuarios.listar().filter(usuario => usuario.cargo === 'professor')
  professorCurso.replaceChildren(new Option(professores.length ? 'Selecione um professor' : 'Nenhum professor cadastrado', ''))
  professores.forEach(professor => professorCurso.add(new Option(professor.nome, professor.email)))
  professorCurso.value = selecionado
  document.getElementById('cursoProfessorAjuda').textContent = professores.length
    ? 'Professores cadastrados em Usuários e Permissões nesta aba.'
    : 'Cadastre um usuário com o cargo Professor em Usuários e Permissões.'
}

cursoForm.addEventListener('change', () => document.getElementById('semanaErro').classList.add('hidden'))

// =========================
// ABRIR / FECHAR MODAL TURMA
// =========================

function abrirModalTurma(cursoId) {
  document.getElementById("curso_id").value = cursoId
  buscarCursoPorId(cursoId)
  turmaForm.reset()
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

  const submitBtn = turmaForm.querySelector('button[type="submit"]')
  submitBtn.disabled = true
  submitBtn.textContent = "Salvando..."

  const turma = {
    curso_id:        Number(document.getElementById("curso_id").value),
    codigo:          document.getElementById("codigo").value,
    disciplina:      document.getElementById("disciplina").value,
    professor_id:    Number(document.getElementById("professor_id").value),
    horario:         document.getElementById("horario").value,
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
    carregarCursos()

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
    carregarCursos()
  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  }
}

// =========================
// ABRIR / FECHAR MODAL CURSO
// =========================

novoCursoBtn.addEventListener("click", () => {
  editandoId = null
  cursoForm.reset()
  document.querySelector("#modal h2").textContent = "Novo curso"
  carregarProfessoresCurso()
  document.getElementById('semanaErro').classList.add('hidden')
  document.querySelector("#modal button[type='submit']").textContent = "Salvar curso"
  modal.classList.remove("hidden")
  modal.classList.add("flex")
})

function closeModal() {
  modal.classList.add("hidden")
  modal.classList.remove("flex")
  cursoForm.reset()
  editandoId = null
}

closeModalBtn.addEventListener("click", closeModal)
cancelModalBtn.addEventListener("click", closeModal)

// =========================
// TOGGLE TURMAS DO CARD
// =========================

function toggleTurmas(id) {
  const menu = document.getElementById(`turmas-${id}`)
  const icon = document.getElementById(`icon-${id}`)
  menu.classList.toggle("hidden")
  icon.classList.toggle("fa-chevron-down")
  icon.classList.toggle("fa-chevron-up")
}

// =========================
// EXCLUIR CURSO
// =========================

async function excluirCurso(id) {
  const confirmar = confirm("Deseja realmente excluir este curso?\nTodas as turmas vinculadas também serão excluídas.")
  if (!confirmar) return

  try {
    const response = await fetch(`${API}/cursos/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json()
      alert(data.error || "Erro ao excluir curso")
      return
    }
    carregarCursos()
  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  }
}

// =========================
// EDITAR CURSO
// =========================

async function editarCurso(id) {
  try {
    const response = await fetch(`${API}/cursos/${id}`)
    if (!response.ok) { alert("Curso não encontrado"); return }

    const curso = await response.json()
    editandoId = id
    cursoForm.reset()
    const detalhes = window.previaCursos.obter(id)
    carregarProfessoresCurso(detalhes.professor_email)
    cursoForm.querySelectorAll('input[name="semana"]').forEach(input => input.checked = (detalhes.semana || []).includes(input.value))
    document.getElementById('curso_horario').value = detalhes.horario || ''
    document.getElementById('semanaErro').classList.add('hidden')

    document.getElementById("nome").value           = curso.nome          || ""
    document.getElementById("qtd_vagas_gerais").value = curso.qtd_vagas_gerais || ""

    document.querySelector("#modal h2").textContent             = "Editar curso"
    document.querySelector("#modal button[type='submit']").textContent = "Salvar alterações"

    modal.classList.remove("hidden")
    modal.classList.add("flex")

  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  }
}

// =========================
// CRIAR / EDITAR CURSO (SUBMIT)
// =========================

cursoForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  if (!cursoForm.reportValidity()) return
  if (!diasCurso().length) {
    document.getElementById('semanaErro').classList.remove('hidden')
    cursoForm.querySelector('input[name="semana"]').focus()
    return
  }
  const professorSelecionado = window.previaUsuarios.listar().find(usuario => usuario.cargo === 'professor' && usuario.email === professorCurso.value)
  if (!professorSelecionado) { carregarProfessoresCurso(); professorCurso.reportValidity(); return }
  const detalhes = { semana: diasCurso(), horario: document.getElementById('curso_horario').value, professor_email: professorSelecionado.email }

  const submitBtn = cursoForm.querySelector('button[type="submit"]')
  submitBtn.disabled = true

  const curso = {
    nome:             document.getElementById("nome").value.trim(),
    qtd_vagas_gerais: Number(document.getElementById("qtd_vagas_gerais").value)
  }

  try {
    const url    = editandoId ? `${API}/cursos/${editandoId}` : `${API}/cursos`
    const method = editandoId ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(curso)
    })

    if (!response.ok) {
      const data = await response.json()
      alert(data.error || "Erro ao salvar curso")
      return
    }

    const salvo = await response.json()
    const idSalvo = editandoId ?? (Array.isArray(salvo) ? salvo[0]?.id : salvo.id)
    if (idSalvo == null) throw new Error('Curso salvo sem identificador para os dados da prévia')
    window.previaCursos.salvar(idSalvo, detalhes)
    closeModal()
    carregarCursos()

  } catch (err) {
    alert("Erro de conexão com o servidor")
    console.error(err)
  } finally {
    submitBtn.disabled = false
  }
})

// =========================
// CARREGAR CURSOS
// =========================

async function carregarCursos() {
  cardsContainer.innerHTML = `
    <div class="col-span-full text-center py-20">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-300 mb-4"></i>
      <p class="text-gray-400">Carregando cursos...</p>
    </div>
  `

  try {
    const response = await fetch(`${API}/cursos`)

    if (!response.ok) throw new Error("Erro ao buscar cursos")

    const cursos = await response.json()

    cardsContainer.innerHTML = ""

    if (cursos.length === 0) {
      cardsContainer.innerHTML = `
        <div class="col-span-full text-center py-20">
          <i class="fa-solid fa-graduation-cap text-5xl text-gray-300 mb-5"></i>
          <h2 class="text-2xl font-semibold text-gray-500 mb-2">Nenhum curso cadastrado</h2>
          <p class="text-gray-400">Clique em "Novo curso" para começar.</p>
        </div>
      `
      return
    }

    // Busca as turmas de cada curso em paralelo para ser mais rápido
    const cursosComTurmas = await Promise.all(
      cursos.map(async (curso) => {
        try {
          const resTurmas = await fetch(`${API}/turmas/${curso.id}`)
          const turmas    = resTurmas.ok ? await resTurmas.json() : []
          return { ...curso, turmas }
        } catch {
          return { ...curso, turmas: [] }
        }
      })
    )

    let html = ""

    for (const curso of cursosComTurmas) {
      const detalhes = window.previaCursos.obter(curso.id)
      const professor = window.previaUsuarios.listar().find(usuario => usuario.cargo === 'professor' && usuario.email === detalhes.professor_email)
      html += `
        <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md duration-300 p-7 mb-6">

          <div class="flex items-start justify-between gap-5">
            <div class="flex-1 min-w-0">

              <p class="text-[11px] tracking-[2px] uppercase text-gray-400 font-semibold mb-3">
                ${escaparCurso((detalhes.semana || []).join(', ') || 'Dias não informados')}
              </p>

              <h2 class="text-2xl font-semibold text-[#111827] mb-5">
                ${escaparCurso(curso.nome)}
              </h2>

              <div class="flex flex-wrap gap-5 text-sm text-gray-500 mb-4">
                <span><i class="fa-regular fa-clock mr-1"></i>${escaparCurso(detalhes.horario || 'Horário não informado')}</span>
                <span><i class="fa-solid fa-users mr-1"></i>${curso.qtd_vagas_gerais || "—"} vagas</span>
              </div>

              <p class="text-sm text-gray-500">
                <i class="fa-regular fa-user mr-1"></i>Professor: ${escaparCurso(professor?.nome || 'Não informado')}
              </p>

            </div>

            <div class="flex items-center gap-2 flex-shrink-0">

              <button onclick="editarCurso(${curso.id})"
                title="Editar curso"
                class="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 duration-200 text-gray-500">
                <i class="fa-solid fa-pen text-sm"></i>
              </button>

              <button onclick="excluirCurso(${curso.id})"
                title="Excluir curso"
                class="w-10 h-10 rounded-xl border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 duration-200 text-gray-500">
                <i class="fa-solid fa-trash text-sm"></i>
              </button>

              <button onclick="toggleTurmas(${curso.id})"
                title="Ver turmas"
                class="w-10 h-10 rounded-xl border-2 border-gray-200 hover:bg-gray-50 duration-200 text-gray-500">
                <i id="icon-${curso.id}" class="fa-solid fa-chevron-down text-sm"></i>
              </button>

            </div>
          </div>

          <!-- TURMAS -->
          <div id="turmas-${curso.id}" class="hidden mt-7 border-t pt-7">

            <div class="flex items-center justify-between mb-5">
              <h3 class="text-sm font-semibold text-gray-700">
                Turmas (${curso.turmas.length})
              </h3>
              <button onclick="abrirModalTurma(${curso.id})"
                class="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 duration-200">
                <i class="fa-solid fa-plus mr-1"></i>Nova turma
              </button>
            </div>

            ${curso.turmas.length === 0 ? `
              <p class="text-sm text-gray-400 py-4 text-center">Nenhuma turma cadastrada para este curso.</p>
            ` : curso.turmas.map(turma => `

              <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">

                <div class="flex justify-between items-start mb-4">
                  <div>
                    <h4 class="font-bold text-sm text-gray-500 mb-1">${turma.codigo || "—"}</h4>
                    <p class="text-lg font-semibold text-gray-800">${turma.disciplina || "—"}</p>
                  </div>
                  <button onclick="excluirTurma(${turma.id})"
                    title="Excluir turma"
                    class="text-gray-400 hover:text-red-500 duration-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50">
                    <i class="fa-solid fa-trash text-sm"></i>
                  </button>
                </div>

                <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span><i class="fa-solid fa-chalkboard-user mr-1"></i>${turma.professor || "Professor não informado"}</span>
                  <span><i class="fa-regular fa-clock mr-1"></i>${turma.horario || "—"}</span>
                  <span><i class="fa-solid fa-location-dot mr-1"></i>${turma.sala || "—"}</span>
                  <span>
                    <i class="fa-solid fa-circle text-[8px] mr-1 ${turma.status === 'ativa' ? 'text-green-500' : 'text-gray-400'}"></i>
                    ${turma.status === 'ativa' ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>

              </div>

            `).join("")}

          </div>

        </div>
      `
    }

    cardsContainer.innerHTML = html

  } catch (err) {
    cardsContainer.innerHTML = `
      <div class="col-span-full text-center py-20">
        <i class="fa-solid fa-triangle-exclamation text-4xl text-red-300 mb-4"></i>
        <h2 class="text-xl font-semibold text-gray-500 mb-2">Erro ao carregar cursos</h2>
        <p class="text-gray-400 mb-4">Não foi possível acessar a API. Tente novamente em instantes.</p>
        <button onclick="carregarCursos()" class="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <i class="fa-solid fa-rotate-right mr-1"></i>Tentar novamente
        </button>
      </div>
    `
    console.error(err)
  }
}

// =========================
// BUSCAR PROFESSOR POR ID (ao digitar no campo)
// =========================

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

// =========================
// INICIAR
// =========================

carregarCursos()
