import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

// ============================
// LISTAR TURMAS POR CURSO
// ============================

router.get('/turmas/:curso_id', async (req, res) => {

  try {

    const { curso_id } = req.params

    const { data, error } = await supabase
      .from('turmas')
      .select(`
        *,
        professores (
          nome
        )
      `)
      .eq('curso_id', curso_id)

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    // FORMATAR RESPOSTA

    const turmasFormatadas = data.map(turma => ({

      ...turma,

      professor: turma.professores?.nome || 'Professor não encontrado'

    }))

    return res.status(200).json(turmasFormatadas)

  }

  catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// ============================
// BUSCAR TURMA POR ID
// ============================

router.get('/turmas/unica/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { data, error } = await supabase
      .from('turmas')
      .select(`
        *,
        professores (
          nome
        )
      `)
      .eq('id', id)
      .single()

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    const turmaFormatada = {

      ...data,

      professor: data.professores?.nome || 'Professor não encontrado'

    }

    return res.status(200).json(turmaFormatada)

  }

  catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// ============================
// CRIAR TURMA
// ============================

router.post('/turmas', async (req, res) => {

  try {

    const {
      curso_id,
      codigo,
      disciplina,
      professor_id,
      horario,
      sala,
      qtd_vagas_turmas,
      status
    } = req.body

    // ============================
    // VALIDAÇÕES
    // ============================

    if(
      !curso_id ||
      !codigo ||
      !disciplina ||
      !professor_id ||
      !horario ||
      !sala ||
      !qtd_vagas_turmas
    ){

      return res.status(400).json({
        error: 'Preencha todos os campos obrigatórios'
      })

    }

    // ============================
    // INSERIR TURMA
    // ============================

    const { data, error } = await supabase
      .from('turmas')
      .insert([
        {
          curso_id,
          codigo,
          disciplina,
          professor_id,
          horario,
          sala,
          qtd_vagas_turmas,

          // PADRONIZAÇÃO
          status: (status || 'ativa').toLowerCase()

        }
      ])
      .select()

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(201).json(data)

  }

  catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// ============================
// EDITAR TURMA
// ============================

router.put('/turmas/:id', async (req, res) => {

  try {

    const { id } = req.params

    const {
      curso_id,
      codigo,
      disciplina,
      professor_id,
      horario,
      sala,
      qtd_vagas_turmas,
      status
    } = req.body

    const { data, error } = await supabase
      .from('turmas')
      .update({
        curso_id,
        codigo,
        disciplina,
        professor_id,
        horario,
        sala,
        qtd_vagas_turmas,
        status
      })
      .eq('id', id)
      .select()

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(200).json(data)

  }

  catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// ============================
// EXCLUIR TURMA
// ============================

router.delete('/turmas/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { error } = await supabase
      .from('turmas')
      .delete()
      .eq('id', id)

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(200).json({
      message: 'Turma removida com sucesso'
    })

  }

  catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

export default router