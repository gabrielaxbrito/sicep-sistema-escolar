import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

// =========================
// LISTAR CURSOS
// =========================

router.get('/cursos', async (req, res) => {

  try {

    // Traz também a quantidade de disciplinas de cada curso
    let { data, error } = await supabase
      .from('cursos')
      .select('*, disciplinas ( count )')

    if(error){

      // Se a tabela "disciplinas" ainda não existir, lista só os cursos
      const retorno = await supabase
        .from('cursos')
        .select('*')

      data  = retorno.data
      error = retorno.error

    }

    if(error){

      return res.status(400).json({
        error: error.message
      })

    }

    const cursos = data.map(({ disciplinas, ...curso }) => ({
      ...curso,
      total_disciplinas: Array.isArray(disciplinas) ? (disciplinas[0]?.count ?? 0) : 0
    }))

    return res.status(200).json(cursos)

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
// DISCIPLINAS DO CURSO
// ============================

function lerDisciplina(body = {}) {

  const nome = String(body.nome ?? '').trim()

  if(!nome){
    return { erro: 'Informe o nome da disciplina.' }
  }

  if(nome.length > 150){
    return { erro: 'O nome da disciplina é muito longo.' }
  }

  let carga = null

  if(body.carga_horaria !== undefined && body.carga_horaria !== null && body.carga_horaria !== ''){

    carga = Number(body.carga_horaria)

    if(!Number.isInteger(carga) || carga <= 0){
      return { erro: 'A carga horária deve ser um número inteiro maior que zero.' }
    }

  }

  const status = String(body.status ?? 'ativa').toLowerCase()

  if(!['ativa', 'inativa'].includes(status)){
    return { erro: 'Status inválido.' }
  }

  return { dados: { nome, carga_horaria: carga, status } }

}

router.get('/cursos/:id/disciplinas', async (req, res) => {

  try {

    const { data, error } = await supabase
      .from('disciplinas')
      .select('*')
      .eq('curso_id', req.params.id)
      .order('nome', { ascending: true })

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.post('/cursos/:id/disciplinas', async (req, res) => {

  try {

    const { erro, dados } = lerDisciplina(req.body)

    if(erro){
      return res.status(400).json({ error: erro })
    }

    const { data, error } = await supabase
      .from('disciplinas')
      .insert([{ ...dados, curso_id: Number(req.params.id) }])
      .select()

    if(error){

      if(error.code === '23505'){
        return res.status(409).json({ error: 'Este curso já tem uma disciplina com esse nome.' })
      }

      return res.status(400).json({ error: error.message })

    }

    return res.status(201).json(data[0])

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.put('/cursos/:id/disciplinas/:disciplina_id', async (req, res) => {

  try {

    const { erro, dados } = lerDisciplina(req.body)

    if(erro){
      return res.status(400).json({ error: erro })
    }

    const { data, error } = await supabase
      .from('disciplinas')
      .update(dados)
      .eq('id', req.params.disciplina_id)
      .eq('curso_id', req.params.id)
      .select()

    if(error){

      if(error.code === '23505'){
        return res.status(409).json({ error: 'Este curso já tem uma disciplina com esse nome.' })
      }

      return res.status(400).json({ error: error.message })

    }

    if(!data || !data.length){
      return res.status(404).json({ error: 'Disciplina não encontrada.' })
    }

    return res.status(200).json(data[0])

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.delete('/cursos/:id/disciplinas/:disciplina_id', async (req, res) => {

  try {

    const { error } = await supabase
      .from('disciplinas')
      .delete()
      .eq('id', req.params.disciplina_id)
      .eq('curso_id', req.params.id)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Disciplina excluída com sucesso' })

  } catch(err){
    return res.status(500).json({ error: err.message })
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

