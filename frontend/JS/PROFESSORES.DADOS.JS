// Fonte simulada. Na integração futura, substituir esta fonte pelos dados da API.
// Os relacionamentos seguem turmas.professor_id e turmas.curso_id.
window.dadosProfessores = {
  professores: [
    { id: 1, nome: 'Ana Carolina Oliveira', email: 'ana.oliveira@example.com', telefone: '(11) 99901-1001', especialidade: 'Matemática', status: 'ativo' },
    { id: 2, nome: 'Carlos Eduardo Santos', email: 'carlos.santos@example.com', telefone: '(11) 99902-1002', especialidade: 'Programação', status: 'ativo' },
    { id: 3, nome: 'Mariana Costa Almeida', email: 'mariana.almeida@example.com', telefone: '(11) 99903-1003', especialidade: 'Língua Portuguesa', status: 'ativo' },
    { id: 4, nome: 'Ricardo Henrique Souza', email: 'ricardo.souza@example.com', telefone: '(11) 99904-1004', especialidade: 'Administração', status: 'ativo' },
    { id: 5, nome: 'Juliana Ferreira Lima', email: 'juliana.lima@example.com', telefone: '(11) 99905-1005', especialidade: 'Banco de Dados', status: 'ativo' },
    { id: 6, nome: 'Paulo Roberto Mendes', email: 'paulo.mendes@example.com', telefone: '', especialidade: 'Física', status: 'ativo' },
    { id: 7, nome: 'Fernanda Alves Rocha', email: 'fernanda.rocha@example.com', telefone: '', especialidade: 'História', status: 'inativo' }
  ],
  cursos: [
    { id: 1, nome: 'Análise e Desenvolvimento de Sistemas', grau: 'Tecnólogo' },
    { id: 2, nome: 'Administração', grau: 'Bacharelado' },
    { id: 3, nome: 'Pedagogia', grau: 'Licenciatura' }
  ],
  turmas: [
    { id: 1, codigo: 'ADS-1A', professor_id: 1, curso_id: 1, disciplina: 'Matemática Aplicada', horario: 'Segunda-feira, 19h às 20h40', sala: 'Sala 12', status: 'ativa' },
    { id: 2, codigo: 'ADM-1A', professor_id: 1, curso_id: 2, disciplina: 'Estatística', horario: 'Quarta-feira, 19h às 20h40', sala: 'Sala 08', status: 'ativa' },
    { id: 3, codigo: 'ADS-1B', professor_id: 2, curso_id: 1, disciplina: 'Lógica de Programação', horario: 'Terça-feira, 19h às 22h', sala: 'Laboratório 01', status: 'ativa' },
    { id: 4, codigo: 'ADS-2A', professor_id: 2, curso_id: 1, disciplina: 'Programação Orientada a Objetos', horario: 'Quinta-feira, 19h às 22h', sala: 'Laboratório 02', status: 'ativa' },
    { id: 5, codigo: 'PED-1A', professor_id: 3, curso_id: 3, disciplina: 'Leitura e Produção Textual', horario: 'Segunda-feira, 19h às 22h', sala: 'Sala 05', status: 'ativa' },
    { id: 6, codigo: 'ADM-2A', professor_id: 4, curso_id: 2, disciplina: 'Gestão de Pessoas', horario: 'Terça-feira, 19h às 20h40', sala: 'Sala 09', status: 'ativa' },
    { id: 7, codigo: 'ADM-3A', professor_id: 4, curso_id: 2, disciplina: 'Planejamento Estratégico', horario: 'Sexta-feira, 19h às 22h', sala: 'Sala 10', status: 'encerrada' },
    { id: 8, codigo: 'ADS-3A', professor_id: 5, curso_id: 1, disciplina: 'Banco de Dados', horario: 'Quarta-feira, 19h às 22h', sala: 'Laboratório 02', status: 'ativa' }
  ]
};
