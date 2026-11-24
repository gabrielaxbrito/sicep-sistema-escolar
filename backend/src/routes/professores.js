
import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

const igual = (valor, esperado) =>
  String(valor || '').toLowerCase() === esperado


// =========================
// TURMAS (AULAS) POR PROFESSOR
// Cada disciplina da grade de uma turma vira um item, no formato que a tela já usa.
// Turmas antigas, sem grade, continuam aparecendo pelos dados que têm na própria turma.
// =========================

async function buscarTurmas(professorId = null) {

  let consultaLegada = supabase
    .from('turmas')
    .select('id, codigo, professor_id, curso_id, disciplina, horario, sala, status')

  if (professorId !== null) {
    consultaLegada = consultaLegada.eq('professor_id', professorId)
  }

  const legada = await consultaLegada
  if (legada.error) return { error: legada.error }

  let consultaGrade = supabase
    .from('turma_disciplinas')
    .select('id, turma_id, professor_id, horario, sala, disciplinas ( nome ), turmas ( id, codigo, curso_id, status )')

  if (professorId !== null) {
    consultaGrade = consultaGrade.eq('professor_id', professorId)
  }

  const grade = await consultaGrade

  // Tabela da grade ainda não criada: usa só os dados antigos
  if (grade.error) return { data: legada.data }

  const daGrade = grade.data
    .filter(linha => linha.turmas)
    .map(linha => ({
      id:           linha.turmas.id,
      codigo:       linha.turmas.codigo,
      professor_id: linha.professor_id,
      curso_id:     linha.turmas.curso_id,
      disciplina:   linha.disciplinas?.nome || null,
      horario:      linha.horario,
      sala:         linha.sala,
      status:       linha.turmas.status
    }))

  // Turmas que já têm grade não entram pelos dados antigos
  const { data: comGrade } = await supabase.from('turma_disciplinas').select('turma_id')
  const idsComGrade = new Set((comGrade || []).map(l => l.turma_id))

  const antigas = legada.data.filter(t => t.disciplina && !idsComGrade.has(t.id))

  return { data: [...daGrade, ...antigas] }

}

// =========================
// LISTAGEM DE PROFESSORES
// Retorna professores, cursos e turmas vinculadas
// =========================

router.get('/', async (req, res) => {

  try {

    // Professores
    const { data: professores, error: erroProfessores } = await supabase
      .from('professores')
      .select('id, nome, email, telefone, especialidade, status')
      .order('nome', { ascending: true })

    if (erroProfessores) {
      return res.status(400).json({ error: erroProfessores.message })
    }

    // Cursos
    const { data: cursos, error: erroCursos } = await supabase
      .from('cursos')
      .select('id, nome, grau')

    if (erroCursos) {
      return res.status(400).json({ error: erroCursos.message })
    }

    // Turmas
    const { data: turmas, error: erroTurmas } = await buscarTurmas()

    if (erroTurmas) {
      return res.status(400).json({ error: erroTurmas.message })
    }

    // Total de professores ativos
    const totalAtivos = professores.filter(
      professor => igual(professor.status, 'ativo')
    ).length

    // Retorno organizado
    return res.status(200).json({
      total_ativos: totalAtivos,
      professores: professores,
      cursos: cursos,
      turmas: turmas
    })

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })

  }

})

// =========================
// DETALHES DE UM PROFESSOR
// Retorna os dados individuais e suas turmas
// =========================

router.get('/:id', async (req, res) => {

  try {

    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'ID de professor inválido'
      })
    }

    // Buscar professor
    const { data: professor, error: erroProfessor } = await supabase
      .from('professores')
      .select('id, nome, email, telefone, especialidade, status')
      .eq('id', id)
      .maybeSingle()

    if (erroProfessor) {
      return res.status(400).json({
        error: erroProfessor.message
      })
    }

    if (!professor) {
      return res.status(404).json({
        error: 'Professor não encontrado'
      })
    }

    // Buscar turmas vinculadas ao professor
    const { data: turmas, error: erroTurmas } = await buscarTurmas(id)

    if (erroTurmas) {
      return res.status(400).json({
        error: erroTurmas.message
      })
    }

    // Buscar cursos
    const { data: cursos, error: erroCursos } = await supabase
      .from('cursos')
      .select('id, nome, grau')

    if (erroCursos) {
      return res.status(400).json({
        error: erroCursos.message
      })
    }

    // Associar nome do curso a cada turma
    const turmasComCurso = turmas.map(turma => {

      const curso = cursos.find(
        item => item.id === turma.curso_id
      )

      return {
        ...turma,
        curso_nome: curso ? curso.nome : 'Curso não identificado'
      }

    })

    return res.status(200).json({
      professor: professor,
      turmas: turmasComCurso
    })

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })

  }

})

export default router
