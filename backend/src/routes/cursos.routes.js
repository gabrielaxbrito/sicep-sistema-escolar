import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

// =========================
// LISTAR CURSOS
// =========================

router.get('/cursos', async (req, res) => {

  try {

    const { data, error } = await supabase
      .from('cursos')
      .select('*')

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(200).json(data)

  } catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// =========================
// CRIAR CURSO
// =========================

router.post('/cursos', async (req, res) => {

  try {

    const {
      nome,
      grau,
      carga_horaria,
      qtd_vagas_gerais,
      coordenador
    } = req.body

    const { data, error } = await supabase
      .from('cursos')
      .insert([
        {
          nome,
          grau,
          carga_horaria,
          qtd_vagas_gerais,
          coordenador
        }
      ])
      .select()

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(201).json(data)

  } catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// =========================
// ATUALIZAR CURSO
// =========================

router.put('/cursos/:id', async (req, res) => {

  try {

    const { id } = req.params

    const {
      nome,
      grau,
      carga_horaria,
      qtd_vagas_gerais,
      coordenador
    } = req.body

    const { data, error } = await supabase
      .from('cursos')
      .update({
        nome,
        grau,
        carga_horaria,
        qtd_vagas_gerais,
        coordenador
      })
      .eq('id', id)
      .select()

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(200).json(data)

  } catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// =========================
// EXCLUIR CURSO
// =========================

router.delete('/cursos/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { error } = await supabase
      .from('cursos')
      .delete()
      .eq('id', id)

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    return res.status(200).json({
      message: 'Curso excluído com sucesso'
    })

  } catch(err){

    return res.status(500).json({
      error: err.message
    })

  }

})

// ============================
// BUSCAR CURSO POR ID
// ============================

router.get('/cursos/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { data, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('id', id)
      .single()

    if(error){

      return res.status(404).json({
        error: 'Curso não encontrado'
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

export default router

