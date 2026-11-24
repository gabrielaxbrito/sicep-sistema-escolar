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
      disciplina:   data.turmas?.disciplina,
      total_aulas:  total,
      presentes,
      frequencia:   percentual
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

})

export default router
