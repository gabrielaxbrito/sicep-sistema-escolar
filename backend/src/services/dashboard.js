export async function obterIndicadores(supabase) {
  const consultas = {
    alunos: () => supabase.from('alunos').select('id', { count: 'exact', head: true }).ilike('status', 'ativo'),
    professores: () => supabase.from('professores').select('id', { count: 'exact', head: true }).ilike('status', 'ativo'),
    turmas: async () => {
      const turmas = []
      for (let inicio = 0; ; inicio += 1000) {
        const resultado = await supabase.from('turmas').select('id, qtd_vagas_turmas')
          .eq('status', 'ativa').order('id').range(inicio, inicio + 999)
        if (resultado.error) throw resultado.error
        turmas.push(...resultado.data)
        if (resultado.data.length < 1000) break
      }
      return { data: turmas }
    },
    matriculas: () => supabase.from('matriculas').select('id, turmas!inner(id)', { count: 'exact', head: true })
      .eq('status', 'ativa').eq('turmas.status', 'ativa')
  }
  const resultados = Object.fromEntries(await Promise.all(Object.entries(consultas).map(async ([nome, consulta]) => {
    try {
      const resultado = await consulta()
      if (resultado.error) throw resultado.error
      return [nome, resultado]
    } catch {
      return [nome, null]
    }
  })))
  const vagas = resultados.turmas?.data.reduce((total, turma) => total + Math.max(0, Number(turma.qtd_vagas_turmas) || 0), 0)
  return {
    alunos: resultados.alunos?.count ?? null,
    professores: resultados.professores?.count ?? null,
    turmas: resultados.turmas?.data.length ?? null,
    ocupacao: vagas == null || resultados.matriculas == null ? null
      : vagas > 0 ? Math.round(resultados.matriculas.count / vagas * 100) : null,
    vagas: vagas ?? null,
    matriculas: resultados.matriculas?.count ?? null,
    erros: Object.keys(resultados).filter(nome => resultados[nome] === null)
  }
}
