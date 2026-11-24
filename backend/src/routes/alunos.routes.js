import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

// =========================
// LISTAR ALUNOS
// Com turmas e cursos via matriculas
// =========================

router.get('/alunos', async (req, res) => {

  try {

    const { data, error } = await supabase
      .from('alunos')
      .select(`
        *,
        matriculas (
          id,
          status,
          turmas (
            id,
            disciplina,
            codigo,
            horario,
            sala,
            cursos (
              id,
              nome
            )
          )
        )
      `)
      .order('nome', { ascending: true })

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// =========================
// BUSCAR ALUNO POR ID
// =========================

router.get('/alunos/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { data, error } = await supabase
      .from('alunos')
      .select(`
        *,
        matriculas (
          id,
          status,
          turmas (
            id,
            disciplina,
            codigo,
            cursos (
              id,
              nome
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if(error){
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }

    return res.status(200).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// =========================
// CRIAR ALUNO
// Campos reais: nome, cpf, email, status
// =========================

router.post('/alunos', async (req, res) => {

  try {

    const { nome, cpf, email, status } = req.body

    if(!nome || !email){
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' })
    }

    const { data, error } = await supabase
      .from('alunos')
      .insert([{
        nome,
        cpf:    cpf || null,
        email,
        status: (status || 'ativo').toLowerCase()
      }])
      .select()

    if(error){

      if(error.code === '23505'){
        return res.status(409).json({ error: 'CPF ou e-mail já cadastrado' })
      }

      return res.status(400).json({ error: error.message })
    }

    return res.status(201).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// EDITAR ALUNO
// ============================

router.put('/alunos/:id', async (req, res) => {

  try {

    const { id }                    = req.params
    const { nome, cpf, email, status } = req.body

    const { data, error } = await supabase
      .from('alunos')
      .update({ nome, cpf: cpf || null, email, status })
      .eq('id', id)
      .select()

    if(error){

      if(error.code === '23505'){
        return res.status(409).json({ error: 'CPF ou e-mail já cadastrado' })
      }

      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// EXCLUIR ALUNO
// ============================

router.delete('/alunos/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { error } = await supabase
      .from('alunos')
      .delete()
      .eq('id', id)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Aluno excluído com sucesso' })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// MATRICULAR ALUNO EM TURMA

router.post('/alunos/:id/matriculas', async (req, res) => {

  try {

    const { id }       = req.params
    const { turma_id } = req.body

    if(!turma_id){
      return res.status(400).json({ error: 'turma_id é obrigatório' })
    }

    const { data, error } = await supabase
      .from('matriculas')
      .insert([{
        aluno_id: Number(id),
        turma_id: Number(turma_id),
        status:   'ativa'
      }])
      .select()

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(201).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// VISÃO GERAL DO ALUNO
// Matrículas, cursos, turmas e frequência de cada uma
// ============================

function resumirFrequencia(registros = []) {
  const total     = registros.length
  const presentes = registros.filter(f => f.presente === true).length
  return {
    total_aulas: total,
    presentes,
    faltas:      total - presentes,
    percentual:  total > 0 ? Math.round((presentes / total) * 100) : null
  }
}

router.get('/alunos/:id/visao-geral', async (req, res) => {

  try {

    const { id } = req.params

    const consultar = (comGrade) => supabase
      .from('alunos')
      .select(`
        id, nome, cpf, email, status, created_at,
        matriculas (
          id,
          status,
          created_at,
          turmas (
            id,
            codigo,
            disciplina,
            horario,
            sala,
            status,
            cursos ( id, nome ),
            professores ( nome )
            ${comGrade ? `, turma_disciplinas ( id, horario, sala, disciplinas ( nome ), professores ( nome ) )` : ''}
          ),
          frequencias ( data, presente, turma_disciplina_id )
        )
      `)
      .eq('id', id)
      .single()

    let { data, error } = await consultar(true)

    // Se a grade das turmas ainda não existir no banco, usa só os dados antigos
    if (error && !data) {
      const retorno = await consultar(false)
      data  = retorno.data
      error = retorno.error
    }

    if (error && !data) {
      // Coluna de frequência por disciplina ainda não criada: consulta o básico
      const basico = await supabase
        .from('alunos')
        .select(`
          id, nome, cpf, email, status, created_at,
          matriculas (
            id, status, created_at,
            turmas ( id, codigo, disciplina, horario, sala, status, cursos ( id, nome ), professores ( nome ) ),
            frequencias ( data, presente )
          )
        `)
        .eq('id', id)
        .single()
      data  = basico.data
      error = basico.error
    }

    if(error || !data){
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }

    const unicos = (lista) => [...new Set(lista.filter(Boolean))]

    const matriculas = (data.matriculas || []).map(m => {

      const registros = m.frequencias || []
      const ultimas   = [...registros]
        .sort((x, y) => String(y.data).localeCompare(String(x.data)))
        .slice(0, 5)

      const t     = m.turmas
      const grade = t?.turma_disciplinas || []

      const disciplinas = grade.length ? unicos(grade.map(g => g.disciplinas?.nome)) : unicos([t?.disciplina])
      const professores = grade.length ? unicos(grade.map(g => g.professores?.nome)) : unicos([t?.professores?.nome])

      return {
        id:             m.id,
        status:         m.status,
        matriculado_em: m.created_at,
        curso:          t?.cursos ? { id: t.cursos.id, nome: t.cursos.nome } : null,
        turma: t ? {
          id:           t.id,
          codigo:       t.codigo,
          status:       t.status,
          disciplinas,
          professores,
          disciplina:   disciplinas.join(', '),
          professor:    professores.join(', ') || null,
          horario:      grade.length ? unicos(grade.map(g => g.horario)).join(' | ') : (t.horario || null),
          sala:         grade.length ? unicos(grade.map(g => g.sala)).join(', ') : (t.sala || null)
        } : null,
        // Frequência de cada disciplina da grade da turma
        por_disciplina: grade.map(g => {
          const dela = registros.filter(f => f.turma_disciplina_id && f.turma_disciplina_id === g.id)
          return { disciplina: g.disciplinas?.nome || 'Disciplina', professor: g.professores?.nome || null, nota: null, ...resumirFrequencia(dela) }
        }),
        frequencia:    resumirFrequencia(registros),
        ultimas_aulas: ultimas.map(f => ({ data: f.data, presente: f.presente === true }))
      }
    })

    const ativas = matriculas.filter(m => String(m.status).toLowerCase() === 'ativa')
    const todos  = (data.matriculas || []).flatMap(m => m.frequencias || [])

    return res.status(200).json({
      aluno: {
        id: data.id, nome: data.nome, cpf: data.cpf,
        email: data.email, status: data.status, created_at: data.created_at
      },
      resumo: {
        total_matriculas:  matriculas.length,
        matriculas_ativas: ativas.length,
        cursos: new Set(ativas.map(m => m.curso?.id).filter(Boolean)).size,
        ...resumirFrequencia(todos)
      },
      matriculas
    })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// FREQUÊNCIA POR MATRÍCULA

router.get('/matriculas/:id/frequencia', async (req, res) => {

  try {

    const { id } = req.params

    // Busca a matrícula com dados do aluno, curso e frequências
    const { data, error } = await supabase
      .from('matriculas')
      .select(`
        id,
        status,
        alunos ( nome ),
        turmas (
          disciplina,
          cursos ( nome )
        ),
        frequencias ( presente )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return res.status(404).json({ error: 'Matrícula não encontrada' })
    }

    // Calcula a frequência
    const total      = data.frequencias.length
    const presentes  = data.frequencias.filter(f => f.presente === true).length
    const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0

    return res.status(200).json({
      matricula_id: data.id,
      nome:         data.alunos?.nome,
      curso:        data.turmas?.cursos?.nome,
      disciplina:   data.turmas?.disciplina || data.turmas?.codigo,
      total_aulas:  total,
      presentes,
      frequencia:   percentual
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

})

export default router
