import express from 'express'
import supabase from '../config/supabase.js'

const router = express.Router()

const igual = (valor, esperado) =>
  String(valor || '').toLowerCase() === esperado

// Quantos cursos aparecem no gráfico de turmas (o resto vira "Outros")
const CURSOS_NO_GRAFICO = 10

// =========================
// RESUMO DO DASHBOARD
// Cards: alunos ativos, turmas ativas, professores ativos e taxa de ocupação
// Gráficos: turmas por curso e alunos cadastrados por mês, ano atual x ano anterior (created_at)
// Tabela: uma linha por curso (turmas, alunos e comparação entre o ano anterior e o atual)
// =========================

router.get('/dashboard/resumo', async (req, res) => {

  try {

    // Alunos cadastrados (status: ativo / inativo; created_at: data do cadastro)
    const { data: alunos, error: erroAlunos } = await supabase
      .from('alunos')
      .select('id, status, created_at')

    if(erroAlunos){
      return res.status(400).json({ error: erroAlunos.message })
    }

    // Cursos
    const { data: cursos, error: erroCursos } = await supabase
      .from('cursos')
      .select('id, nome')

    if(erroCursos){
      return res.status(400).json({ error: erroCursos.message })
    }

    // Turmas (com o total de vagas de cada uma)
    const { data: turmas, error: erroTurmas } = await supabase
      .from('turmas')
      .select('id, curso_id, codigo, disciplina, status, qtd_vagas_turmas')

    if(erroTurmas){
      return res.status(400).json({ error: erroTurmas.message })
    }

    // Matrículas
    const { data: matriculas, error: erroMatriculas } = await supabase
      .from('matriculas')
      .select('id, aluno_id, turma_id, status')

    if(erroMatriculas){
      return res.status(400).json({ error: erroMatriculas.message })
    }

    // Professores
    // Se a tabela tiver a coluna "status", conta só os que não estão inativos.
    // Se não tiver, conta todos.
    let professores = await supabase
      .from('professores')
      .select('id, status')

    if(professores.error){

      professores = await supabase
        .from('professores')
        .select('id')

      if(professores.error){
        return res.status(400).json({ error: professores.error.message })
      }

    }

    const professoresAtivos = professores.data.filter(
      professor => !igual(professor.status, 'inativo')
    ).length

    // Alunos ativos
    const alunosAtivos = alunos.filter(aluno => igual(aluno.status, 'ativo')).length

    // Turmas ativas
    const turmasAtivas = turmas.filter(turma => igual(turma.status, 'ativa'))
    const idsTurmasAtivas = new Set(turmasAtivas.map(turma => turma.id))

    // Matrículas ativas
    const matriculasAtivas = matriculas.filter(matricula => igual(matricula.status, 'ativa'))

    // Taxa de ocupação = matrículas ativas em turmas ativas / vagas das turmas ativas
    const vagasTotais = turmasAtivas.reduce(
      (soma, turma) => soma + (Number(turma.qtd_vagas_turmas) || 0),
      0
    )

    const vagasPreenchidas = matriculasAtivas.filter(
      matricula => idsTurmasAtivas.has(matricula.turma_id)
    ).length

    const taxaOcupacao = vagasTotais > 0
      ? Math.round((vagasPreenchidas / vagasTotais) * 100)
      : 0

    // =========================
    // GRÁFICO 1: turmas cadastradas por curso (todas as turmas, de qualquer status)
    // =========================

    const porCurso = cursos
      .map(curso => ({
        curso_id: curso.id,
        curso: curso.nome || 'Sem nome',
        total: turmas.filter(turma => turma.curso_id === curso.id).length
      }))
      .sort((a, b) => b.total - a.total || a.curso.localeCompare(b.curso, 'pt-BR'))

    let turmasPorCurso = porCurso

    if(porCurso.length > CURSOS_NO_GRAFICO){

      const resto = porCurso.slice(CURSOS_NO_GRAFICO - 1)

      turmasPorCurso = [
        ...porCurso.slice(0, CURSOS_NO_GRAFICO - 1),
        {
          curso_id: null,
          curso: `Outros (${resto.length} cursos)`,
          total: resto.reduce((soma, item) => soma + item.total, 0)
        }
      ]

    }

    // =========================
    // GRÁFICO 2: alunos cadastrados por mês, ano atual x ano anterior (campo created_at)
    // Usa os 7 primeiros caracteres ("AAAA-MM") para não mudar de mês por fuso horário.
    // O ano atual é o ano mais recente que aparece nos cadastros.
    // =========================

    const contagem = {}
    const anosComCadastro = []

    alunos.forEach(aluno => {

      const anoMes = String(aluno.created_at || '').slice(0, 7)

      if(/^\d{4}-\d{2}$/.test(anoMes)){
        contagem[anoMes] = (contagem[anoMes] || 0) + 1
        anosComCadastro.push(Number(anoMes.slice(0, 4)))
      }

    })

    let alunosPorAnoMes = null

    if(anosComCadastro.length){

      const anoAtual = Math.max(...anosComCadastro)
      const anoAnterior = anoAtual - 1
      const doisDigitos = n => String(n).padStart(2, '0')

      // No ano em andamento, os meses que ainda não chegaram ficam sem valor (a linha termina no mês atual)
      const hoje = new Date()
      let ultimoMesAtual = anoAtual === hoje.getFullYear() ? hoje.getMonth() + 1 : 12

      for(let mes = 12; mes > ultimoMesAtual; mes--){
        if(contagem[`${anoAtual}-${doisDigitos(mes)}`]){
          ultimoMesAtual = mes
          break
        }
      }

      const meses = []

      for(let mes = 1; mes <= 12; mes++){
        meses.push({
          mes,
          atual: mes <= ultimoMesAtual ? (contagem[`${anoAtual}-${doisDigitos(mes)}`] || 0) : null,
          anterior: contagem[`${anoAnterior}-${doisDigitos(mes)}`] || 0
        })
      }

      alunosPorAnoMes = { ano_atual: anoAtual, ano_anterior: anoAnterior, meses }

    }

    // =========================
    // TABELA: uma linha por curso
    // - turmas: turmas cadastradas no curso (qualquer status, igual ao gráfico de turmas)
    // - alunos: alunos ATIVOS com matrícula ativa em turmas do curso (cada aluno conta uma vez)
    // - alunos_ano_anterior / alunos_ano_atual: desses alunos, quantos foram cadastrados em cada ano
    //   (os dois anos são os mesmos do gráfico de linhas)
    // - a última linha, "Sem matrícula ativa", reúne os alunos ativos que ainda não estão em nenhuma turma.
    //   Assim o total da tabela é igual ao card "Alunos ativos".
    // =========================

    const anoAtualTabela = alunosPorAnoMes ? alunosPorAnoMes.ano_atual : null
    const anoAnteriorTabela = alunosPorAnoMes ? alunosPorAnoMes.ano_anterior : null

    const alunosPorId = new Map(alunos.map(aluno => [aluno.id, aluno]))
    const turmasPorId = new Map(turmas.map(turma => [turma.id, turma]))

    const anoDoAluno = alunoId => {
      const aluno = alunosPorId.get(alunoId)
      return aluno ? Number(String(aluno.created_at || '').slice(0, 4)) : null
    }

    // Quantos alunos de um conjunto foram cadastrados no ano anterior / no ano atual
    const contarPorAno = idsDosAlunos => {
      let anterior = 0
      let atual = 0

      idsDosAlunos.forEach(alunoId => {
        const ano = anoDoAluno(alunoId)
        if(ano === anoAnteriorTabela){
          anterior++
        } else if(ano === anoAtualTabela){
          atual++
        }
      })

      return { anterior, atual }
    }

    const alunosPorCurso = new Map()
    const todosOsAlunosMatriculados = new Set()

    matriculasAtivas.forEach(matricula => {

      const turma = turmasPorId.get(matricula.turma_id)

      const alunoDaMatricula = alunosPorId.get(matricula.aluno_id)

      if(!turma || !alunoDaMatricula || !igual(alunoDaMatricula.status, 'ativo')){
        return
      }

      if(!alunosPorCurso.has(turma.curso_id)){
        alunosPorCurso.set(turma.curso_id, new Set())
      }

      alunosPorCurso.get(turma.curso_id).add(matricula.aluno_id)
      todosOsAlunosMatriculados.add(matricula.aluno_id)

    })

    const linhasTabela = cursos
      .map(curso => {

        const idsDosAlunos = alunosPorCurso.get(curso.id) || new Set()
        const porAno = contarPorAno(idsDosAlunos)

        return {
          curso: curso.nome || 'Sem nome',
          turmas: turmas.filter(turma => turma.curso_id === curso.id).length,
          alunos: idsDosAlunos.size,
          alunos_ano_anterior: porAno.anterior,
          alunos_ano_atual: porAno.atual
        }

      })
      .sort((a, b) =>
        b.alunos - a.alunos ||
        b.turmas - a.turmas ||
        a.curso.localeCompare(b.curso, 'pt-BR')
      )

    // Alunos ativos que ainda não estão em nenhuma turma
    const alunosSemMatricula = new Set(
      alunos
        .filter(aluno => igual(aluno.status, 'ativo') && !todosOsAlunosMatriculados.has(aluno.id))
        .map(aluno => aluno.id)
    )

    const semMatriculaPorAno = contarPorAno(alunosSemMatricula)

    linhasTabela.push({
      curso: 'Sem matrícula ativa',
      turmas: null,
      alunos: alunosSemMatricula.size,
      alunos_ano_anterior: semMatriculaPorAno.anterior,
      alunos_ano_atual: semMatriculaPorAno.atual,
      sem_curso: true
    })

    const todosOsAlunosAtivos = new Set([...todosOsAlunosMatriculados, ...alunosSemMatricula])
    const totaisPorAno = contarPorAno(todosOsAlunosAtivos)

    const tabelaCursos = {
      ano_anterior: anoAnteriorTabela,
      ano_atual: anoAtualTabela,
      linhas: linhasTabela,
      totais: {
        turmas: linhasTabela.reduce((soma, linha) => soma + (linha.turmas || 0), 0),
        alunos: todosOsAlunosAtivos.size,
        alunos_ano_anterior: totaisPorAno.anterior,
        alunos_ano_atual: totaisPorAno.atual
      }
    }

    return res.status(200).json({
      alunos_ativos: alunosAtivos,
      matriculas_ativas: matriculasAtivas.length,
      turmas_ativas: turmasAtivas.length,
      professores_ativos: professoresAtivos,
      vagas_totais: vagasTotais,
      vagas_preenchidas: vagasPreenchidas,
      taxa_ocupacao: taxaOcupacao,
      turmas_por_curso: turmasPorCurso,
      alunos_por_ano_mes: alunosPorAnoMes,
      alunos_com_matricula_ativa: todosOsAlunosMatriculados.size,
      tabela_cursos: tabelaCursos
    })

  } catch(err){

    return res.status(500).json({ error: err.message })

  }

})

export default router
