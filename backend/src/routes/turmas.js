import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

// ============================
// AUXILIARES
// ============================

const SELECT_GRADE = `
  id,
  disciplina_id,
  professor_id,
  horario,
  sala,
  disciplinas ( nome ),
  professores ( nome )
`

// Uma linha da grade no formato que a tela usa
function formatarGrade(td) {
  return {
    id:            td.id,
    disciplina_id: td.disciplina_id,
    disciplina:    td.disciplinas?.nome || 'Disciplina',
    professor_id:  td.professor_id,
    professor:     td.professores?.nome || null,
    horario:       td.horario || '',
    sala:          td.sala || ''
  }
}

// Turmas antigas (antes da grade) ainda têm disciplina/professor/horário na própria turma
function gradeLegada(turma) {
  if (!turma.disciplina) return []
  return [{
    id:            null,
    disciplina_id: null,
    disciplina:    turma.disciplina,
    professor_id:  turma.professor_id ?? null,
    professor:     turma.professores?.nome || null,
    horario:       turma.horario || '',
    sala:          turma.sala || ''
  }]
}

function resumoProfessores(grade) {
  const nomes = [...new Set(grade.map(g => g.professor).filter(Boolean))]
  return nomes.length ? nomes.join(', ') : 'Professor não informado'
}

const ativa = (status) => String(status || '').toLowerCase() === 'ativa'

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

// ============================
// LISTAR TURMAS POR CURSO
// ============================

router.get('/turmas/:curso_id', async (req, res) => {

  try {

    const { curso_id } = req.params

    const colunas = (grade) => `
      *,
      professores ( nome ),
      ${grade ? `turma_disciplinas ( ${SELECT_GRADE} ),` : ''}
      matriculas (
        id,
        status,
        frequencias ( presente )
      )
    `

    let { data, error } = await supabase
      .from('turmas')
      .select(colunas(true))
      .eq('curso_id', curso_id)

    // Se a tabela "turma_disciplinas" ainda não existir, usa só os dados antigos
    if (error) {
      const retorno = await supabase
        .from('turmas')
        .select(colunas(false))
        .eq('curso_id', curso_id)
      data  = retorno.data
      error = retorno.error
    }

    if(error){
      return res.status(400).json({ error: error.message })
    }

    const turmas = data.map(({ matriculas, turma_disciplinas, ...turma }) => {

      const grade = (turma_disciplinas && turma_disciplinas.length)
        ? turma_disciplinas.map(formatarGrade)
        : gradeLegada(turma)

      const ativas    = (matriculas || []).filter(m => ativa(m.status))
      const registros = ativas.flatMap(m => m.frequencias || [])
      const presentes = registros.filter(f => f.presente === true).length
      const vagas     = Number(turma.qtd_vagas_turmas) || 0

      return {
        ...turma,
        disciplinas:           grade,
        professor:             resumoProfessores(grade),
        matriculados:          ativas.length,
        vagas_livres:          Math.max(0, vagas - ativas.length),
        frequencia_total:      registros.length,
        frequencia_presentes:  presentes,
        frequencia_percentual: registros.length > 0 ? Math.round((presentes / registros.length) * 100) : null
      }

    })

    return res.status(200).json(turmas)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// RESUMO DA TURMA
// Vagas, alunos matriculados e frequência
// ============================

router.get('/turmas/:id/resumo', async (req, res) => {

  try {

    const { id } = req.params

    const colunas = (grade) => `
      id, codigo, status, qtd_vagas_turmas, disciplina, horario, sala, professor_id,
      cursos ( id, nome ),
      professores ( nome ),
      ${grade ? `turma_disciplinas ( ${SELECT_GRADE} ),` : ''}
      matriculas (
        id,
        status,
        alunos ( id, nome, email, status ),
        frequencias ( data, presente )
      )
    `

    let { data, error } = await supabase
      .from('turmas')
      .select(colunas(true))
      .eq('id', id)
      .single()

    if (error && !data) {
      const retorno = await supabase.from('turmas').select(colunas(false)).eq('id', id).single()
      data  = retorno.data
      error = retorno.error
    }

    if(error || !data){
      return res.status(404).json({ error: 'Turma não encontrada' })
    }

    const grade = (data.turma_disciplinas && data.turma_disciplinas.length)
      ? data.turma_disciplinas.map(formatarGrade)
      : gradeLegada(data)

    const ativas    = (data.matriculas || []).filter(m => ativa(m.status))
    const registros = ativas.flatMap(m => m.frequencias || [])
    const vagas     = Number(data.qtd_vagas_turmas) || 0

    const alunos = (data.matriculas || [])
      .map(m => ({
        matricula_id: m.id,
        aluno_id:     m.alunos?.id,
        nome:         m.alunos?.nome || '—',
        email:        m.alunos?.email || null,
        status:       m.status,
        frequencia:   resumirFrequencia(m.frequencias || []),
        registros:    (m.frequencias || []).map(f => ({ data: String(f.data || '').slice(0, 10), presente: f.presente === true }))
      }))
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))

    return res.status(200).json({
      turma: {
        id: data.id, codigo: data.codigo, status: data.status,
        curso:       data.cursos?.nome || null,
        professor:   resumoProfessores(grade),
        disciplinas: grade
      },
      vagas: {
        total:    vagas,
        ocupadas: ativas.length,
        livres:   Math.max(0, vagas - ativas.length)
      },
      frequencia: {
        aulas_lancadas: new Set(registros.map(f => f.data)).size,
        ...resumirFrequencia(registros),
        datas: [...new Set(registros.map(f => String(f.data || '').slice(0, 10)))].filter(Boolean).sort()
      },
      alunos
    })

  } catch(err){
    return res.status(500).json({ error: err.message })
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
        professores ( nome ),
        turma_disciplinas ( ${SELECT_GRADE} )
      `)
      .eq('id', id)
      .single()

    if(error){
      return res.status(400).json({ error: error.message })
    }

    const { turma_disciplinas, ...turma } = data
    const grade = (turma_disciplinas && turma_disciplinas.length)
      ? turma_disciplinas.map(formatarGrade)
      : gradeLegada(turma)

    return res.status(200).json({
      ...turma,
      disciplinas: grade,
      professor:   resumoProfessores(grade)
    })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// CRIAR TURMA (o grupo de alunos)
// As disciplinas entram depois, em /turmas/:id/disciplinas
// ============================

router.post('/turmas', async (req, res) => {

  try {

    const { curso_id, codigo, qtd_vagas_turmas, status } = req.body

    if(!curso_id || !String(codigo ?? '').trim() || !qtd_vagas_turmas){
      return res.status(400).json({ error: 'Preencha o curso, o código e a quantidade de vagas.' })
    }

    const { data, error } = await supabase
      .from('turmas')
      .insert([{
        curso_id,
        codigo: String(codigo).trim(),
        qtd_vagas_turmas,
        status: String(status || 'ativa').toLowerCase()
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
// EDITAR TURMA
// ============================

router.put('/turmas/:id', async (req, res) => {

  try {

    const { id } = req.params
    const { curso_id, codigo, qtd_vagas_turmas, status } = req.body

    const { data, error } = await supabase
      .from('turmas')
      .update({
        curso_id,
        codigo: codigo === undefined ? undefined : String(codigo).trim(),
        qtd_vagas_turmas,
        status: status === undefined ? undefined : String(status).toLowerCase()
      })
      .eq('id', id)
      .select()

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data)

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// EXCLUIR TURMA
// ============================

router.delete('/turmas/:id', async (req, res) => {

  try {

    const { id } = req.params

    const { data: matriculas, error: erroMatriculas } = await supabase
      .from('matriculas')
      .select('id')
      .eq('turma_id', id)

    if(erroMatriculas){
      return res.status(400).json({ error: erroMatriculas.message })
    }

    if(matriculas && matriculas.length){
      return res.status(409).json({
        error: `Esta turma tem ${matriculas.length} matrícula(s). Remova as matrículas antes de excluir a turma.`
      })
    }

    const { error } = await supabase
      .from('turmas')
      .delete()
      .eq('id', id)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Turma removida com sucesso' })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

// ============================
// GRADE DA TURMA (disciplinas, professor, horário e sala)
// ============================

async function lerLinhaGrade(turmaId, body = {}) {

  const { data: turma, error } = await supabase
    .from('turmas')
    .select('id, curso_id, status')
    .eq('id', turmaId)
    .single()

  if(error || !turma){
    return { status: 404, erro: 'Turma não encontrada.' }
  }

  const disciplinaId = Number(body.disciplina_id)

  if(!Number.isInteger(disciplinaId) || disciplinaId <= 0){
    return { status: 400, erro: 'Selecione a disciplina.' }
  }

  const { data: disciplina } = await supabase
    .from('disciplinas')
    .select('id, curso_id')
    .eq('id', disciplinaId)
    .maybeSingle()

  if(!disciplina || disciplina.curso_id !== turma.curso_id){
    return { status: 400, erro: 'Esta disciplina não pertence ao curso da turma.' }
  }

  let professorId = null

  if(body.professor_id !== undefined && body.professor_id !== null && body.professor_id !== ''){

    professorId = Number(body.professor_id)

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('id', professorId)
      .maybeSingle()

    if(!professor){
      return { status: 400, erro: 'Professor não encontrado.' }
    }

  }

  const horario = String(body.horario ?? '').trim()

  if(!horario && String(turma.status).toLowerCase() !== 'encerrada'){
    return { status: 400, erro: 'Informe os dias e o horário da aula.' }
  }

  return {
    dados: {
      disciplina_id: disciplinaId,
      professor_id:  professorId,
      horario:       horario || null,
      sala:          String(body.sala ?? '').trim() || null
    }
  }

}

router.get('/turmas/:id/disciplinas', async (req, res) => {

  try {

    const { data, error } = await supabase
      .from('turma_disciplinas')
      .select(SELECT_GRADE)
      .eq('turma_id', req.params.id)
      .order('id', { ascending: true })

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data.map(formatarGrade))

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.post('/turmas/:id/disciplinas', async (req, res) => {

  try {

    const { erro, status, dados } = await lerLinhaGrade(req.params.id, req.body)

    if(erro){
      return res.status(status).json({ error: erro })
    }

    const { data, error } = await supabase
      .from('turma_disciplinas')
      .insert([{ ...dados, turma_id: Number(req.params.id) }])
      .select(SELECT_GRADE)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(201).json(formatarGrade(data[0]))

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.put('/turmas/:id/disciplinas/:linha_id', async (req, res) => {

  try {

    const { erro, status, dados } = await lerLinhaGrade(req.params.id, req.body)

    if(erro){
      return res.status(status).json({ error: erro })
    }

    const { data, error } = await supabase
      .from('turma_disciplinas')
      .update(dados)
      .eq('id', req.params.linha_id)
      .eq('turma_id', req.params.id)
      .select(SELECT_GRADE)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    if(!data || !data.length){
      return res.status(404).json({ error: 'Disciplina da turma não encontrada.' })
    }

    return res.status(200).json(formatarGrade(data[0]))

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.delete('/turmas/:id/disciplinas/:linha_id', async (req, res) => {

  try {

    const { error } = await supabase
      .from('turma_disciplinas')
      .delete()
      .eq('id', req.params.linha_id)
      .eq('turma_id', req.params.id)

    if(error){
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Disciplina removida da turma.' })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})
// ============================
// PRESENÇA (chamada por disciplina da turma e data)
// ============================

const hojeBrasil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`))

const MSG_COLUNA = 'A frequência por disciplina ainda não está pronta no banco. Rode no Supabase a coluna "turma_disciplina_id" e o índice "frequencias_aula_uq" (passo 5 do SQL).'

async function carregarChamada(turmaId, tdId, data) {

  const { data: turma, error } = await supabase
    .from('turmas')
    .select('id, codigo, status')
    .eq('id', turmaId)
    .single()

  if(error || !turma){
    return { status: 404, erro: 'Turma não encontrada.' }
  }

  const { data: linha } = await supabase
    .from('turma_disciplinas')
    .select('id, turma_id')
    .eq('id', tdId)
    .maybeSingle()

  if(!linha || linha.turma_id !== turma.id){
    return { status: 400, erro: 'Esta disciplina não faz parte da grade da turma.' }
  }

  const { data: matriculas, error: erroMatriculas } = await supabase
    .from('matriculas')
    .select('id, status, alunos ( id, nome )')
    .eq('turma_id', turma.id)

  if(erroMatriculas){
    return { status: 400, erro: erroMatriculas.message }
  }

  const ativas = (matriculas || []).filter(m => ativa(m.status))

  return { turma, ativas }

}

router.get('/turmas/:id/presenca', async (req, res) => {

  try {

    const tdId = Number(req.query.turma_disciplina_id)
    const data = String(req.query.data || '')

    if(!Number.isInteger(tdId) || tdId <= 0 || !dataValida(data)){
      return res.status(400).json({ error: 'Informe a disciplina e uma data válida.' })
    }

    const { erro, status, ativas } = await carregarChamada(req.params.id, tdId, data)

    if(erro){
      return res.status(status).json({ error: erro })
    }

    let registros = []

    if(ativas.length){

      const { data: lancados, error } = await supabase
        .from('frequencias')
        .select('matricula_id, presente')
        .eq('turma_disciplina_id', tdId)
        .eq('data', data)
        .in('matricula_id', ativas.map(m => m.id))

      if(error){
        return res.status(400).json({ error: error.message.includes('turma_disciplina_id') ? MSG_COLUNA : error.message })
      }

      registros = lancados || []

    }

    const porMatricula = new Map(registros.map(r => [r.matricula_id, r.presente === true]))

    const alunos = ativas
      .map(m => ({
        matricula_id: m.id,
        aluno_id:     m.alunos?.id,
        nome:         m.alunos?.nome || '—',
        presente:     porMatricula.has(m.id) ? porMatricula.get(m.id) : null
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    // Título e resumo da aula (tabela opcional: sem ela a chamada continua funcionando)
    let aula = null
    let aulaDisponivel = true

    const { data: registroAula, error: erroAula } = await supabase
      .from('aulas')
      .select('titulo, conteudo')
      .eq('turma_disciplina_id', tdId)
      .eq('data', data)
      .maybeSingle()

    if(erroAula){
      aulaDisponivel = false
    } else if(registroAula){
      aula = { titulo: registroAula.titulo || '', conteudo: registroAula.conteudo || '' }
    }

    return res.status(200).json({
      data,
      lancada: registros.length > 0,
      aula,
      aula_disponivel: aulaDisponivel,
      alunos
    })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

router.post('/turmas/:id/presenca', async (req, res) => {

  try {

    const tdId      = Number(req.body?.turma_disciplina_id)
    const data      = String(req.body?.data || '')
    const registros = Array.isArray(req.body?.registros) ? req.body.registros : []

    if(!Number.isInteger(tdId) || tdId <= 0 || !dataValida(data)){
      return res.status(400).json({ error: 'Informe a disciplina e uma data válida.' })
    }

    if(data > hojeBrasil()){
      return res.status(400).json({ error: 'Não é possível lançar presença em data futura.' })
    }

    const { erro, status, turma, ativas } = await carregarChamada(req.params.id, tdId, data)

    if(erro){
      return res.status(status).json({ error: erro })
    }

    if(!ativa(turma.status)){
      return res.status(400).json({ error: 'Esta turma está encerrada e não recebe novas chamadas.' })
    }

    const idsAtivos = new Set(ativas.map(m => m.id))

    if(!registros.length || registros.some(r => !idsAtivos.has(Number(r.matricula_id)))){
      return res.status(400).json({ error: 'A lista de alunos não confere com as matrículas ativas da turma. Recarregue a chamada.' })
    }

    const linhas = registros.map(r => ({
      matricula_id:        Number(r.matricula_id),
      turma_disciplina_id: tdId,
      data,
      presente:            r.presente === true
    }))

    const { error } = await supabase
      .from('frequencias')
      .upsert(linhas, { onConflict: 'matricula_id,turma_disciplina_id,data' })

    if(error){
      const coluna = /turma_disciplina_id|no unique or exclusion constraint/i.test(error.message)
      if(/unique_frequencia/i.test(error.message)){
        return res.status(400).json({ error: 'O banco ainda tem a regra antiga "unique_frequencia" (1 presença por aluno por dia), que impede lançar mais de uma disciplina no mesmo dia. Rode no Supabase: alter table frequencias drop constraint if exists unique_frequencia;' })
      }
      return res.status(400).json({ error: coluna ? MSG_COLUNA : error.message })
    }

    const presentes = linhas.filter(l => l.presente).length

    // Título e resumo da aula (opcionais)
    const titulo   = String(req.body?.titulo   ?? '').trim().slice(0, 150)
    const conteudo = String(req.body?.conteudo ?? '').trim().slice(0, 2000)
    let aulaSalva = true
    let aviso = null

    if(titulo || conteudo){

      const { error: erroAula } = await supabase
        .from('aulas')
        .upsert({ turma_disciplina_id: tdId, data, titulo: titulo || null, conteudo: conteudo || null },
                { onConflict: 'turma_disciplina_id,data' })

      if(erroAula){
        aulaSalva = false
        aviso = 'A presença foi salva, mas o título e o resumo da aula não: crie a tabela "aulas" no Supabase (arquivo sql/aulas.sql).'
      }

    } else {

      // Campos vazios: remove o registro antigo, se existir
      await supabase.from('aulas').delete().eq('turma_disciplina_id', tdId).eq('data', data)

    }

    return res.status(200).json({
      message:   'Presença salva com sucesso.',
      presentes,
      faltas:    linhas.length - presentes,
      aula_salva: aulaSalva,
      aviso
    })

  } catch(err){
    return res.status(500).json({ error: err.message })
  }

})

export default router
