/* ============================================================================
 * AJUDA.JS — Assistente de IA do SICEP (arquivo único, "plug-and-play")
 * ============================================================================
 *
 * COMO USAR
 *   Basta incluir esta linha no final do <body> de cada página interna:
 *     <script src="../JS/AJUDA.JS"></script>
 *   O arquivo cria sozinho o ícone flutuante, o painel de conversa, o CSS e a
 *   lógica de guia. Não depende de nenhum outro arquivo do front-end.
 *
 * O QUE ELE FAZ
 *   1. Mostra um ícone no canto inferior direito (pode ser ARRASTADO).
 *   2. Ao clicar, abre uma caixa onde a pessoa escreve o que quer fazer
 *      ("quero criar um novo curso", "como adiciono um aluno?").
 *   3. A pergunta vai para o backend (rota POST /ajuda), que consulta a IA
 *      (Groq). A IA devolve a INTENÇÃO: um roteiro pronto ou uma lista de
 *      passos montada só com elementos reais do SICEP.
 *   4. O assistente destaca, passo a passo, onde clicar — navegando entre
 *      páginas quando necessário. Ele NUNCA clica nem preenche nada pelo
 *      usuário: só mostra o caminho.
 *
 * SEGURANÇA
 *   A chave da IA NÃO fica aqui. Ela fica só no servidor (.env →
 *   GROQ_API_KEY). Este arquivo apenas chama o backend.
 *
 * COMO MANTER (quando o SICEP mudar)
 *   - Mudou o id/botão de uma tela? Ajuste o seletor em ELEMENTOS.
 *   - Quer ensinar um fluxo novo? Crie uma entrada em ROTEIROS.
 *   - Backend em outra porta/endereço? Defina antes deste script:
 *       <script>window.SICEP_API_URL = 'http://meu-servidor:3000'</script>
 * ========================================================================== */

;(function () {
  'use strict'

  // Evita carregar duas vezes se o script for incluído em duplicidade.
  if (window.__sicepAjudaCarregado) return
  window.__sicepAjudaCarregado = true

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CONFIGURAÇÃO
  // ══════════════════════════════════════════════════════════════════════════

  // Mesmo endereço que os outros scripts do SICEP usam (ex.: CURSOS.JS).
  const API_URL = String(window.SICEP_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

  const CHAVE_POSICAO = 'sicep_ajuda_posicao' // localStorage: onde o ícone foi deixado
  const CHAVE_ESTADO  = 'sicep_ajuda_estado'  // sessionStorage: guia em andamento
  const ESPERA_ELEMENTO_MS = 5000             // quanto tempo esperar um elemento aparecer
  const MAX_NAVEGACOES = 6                    // trava contra loop de redirecionamento
  const TAMANHO_BOTAO = 52

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CATÁLOGO DO SISTEMA
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A IA nunca "chuta" seletores CSS. Ela só escolhe CHAVES deste catálogo,
  // e o código confere se cada chave existe antes de destacar qualquer coisa.
  // Isso impede o assistente de apontar para botões inexistentes.

  // 2.1 — O que cada página faz (ajuda a IA a responder dúvidas gerais).
  const PAGINAS = {
    'DASHBOARD.HTML':     'Dashboard: indicadores gerais (alunos matriculados, turmas ativas, professores ativos, taxa de ocupação).',
    'ALUNOS.HTML':        'Alunos: cadastrar, buscar, filtrar, editar, excluir e matricular alunos em turmas.',
    'CURSOS.HTML':        'Cursos: cadastrar, editar e excluir cursos; abrir as turmas de cada curso.',
    'TURMAS.HTML':        'Turmas: cadastrar (disciplina, professor, dias, horário, sala, vagas), filtrar por curso e excluir.',
    'DOCUMENTOS.HTML':    'Documentos: emitir declarações e comprovantes em PDF; solicitar certificado de conclusão.',
    'GRADE_HORARIA.HTML': 'Grade Horária: ver a semana de aulas; filtrar por curso, professor, turno ou disciplina; atualizar e imprimir.',
    'PROFESSORES.HTML':   'Professores: consultar o corpo docente, buscar por nome e ver detalhes e turmas.',
    'USUARIOS.HTML':      'Usuário e Permissões: cadastrar e editar usuários do sistema com um cargo (inclusive Professor).'
  }

  // 2.2 — O que o sistema AINDA NÃO faz. A IA usa isto para não prometer o
  // que não existe e para orientar a alternativa correta.
  const LIMITACOES = [
    'Turmas não podem ser editadas: só criadas e excluídas.',
    'Para cadastrar uma turma é preciso informar o código (ID) numérico do curso e do professor; os nomes aparecem sozinhos depois de digitar o código.',
    'Ao excluir um curso ou uma turma o navegador pede uma confirmação. Excluir um curso também exclui as turmas dele.',
    'A página Professores é só de consulta. Para cadastrar um professor novo usa-se "Usuário e Permissões" com o cargo "Professor"; nesse módulo os cadastros ficam apenas em uma prévia da sessão do navegador.',
    'Em Documentos, a Declaração de Frequência e o Histórico de Frequência usam o ID da matrícula; os demais documentos usam o ID do aluno.',
    'Em Documentos, "Boletim de Notas", "Grade Horária Individual" e "Comprovante de Conclusão de Módulo" ainda não estão disponíveis para emissão, e a "Declaração de Trancamento" ainda não tem envio integrado.',
    'O item "Processos Acadêmicos" do menu aparece como "Em breve" e ainda não funciona.',
    'O login ainda não está disponível: o acesso ao sistema é pelo link "Acessar dashboard" da tela inicial.'
  ]

  // 2.3 — ELEMENTOS: cada item clicável/preenchível que o assistente sabe
  // destacar. Formato: chave → [seletor CSS, descrição, opções?]
  //
  //   seletor  → como achar o elemento na página.
  //   descrição→ vai para a IA: é com ela que a IA "entende" o que cada item faz.
  //              Por isso diz o que o item ABRE ou FAZ (ex.: "abre a janela...").
  //
  // opções:
  //   contem   → filtra, entre os que casam com o seletor, o que contém esse
  //              texto. Necessário para botões criados pelo JS das telas, que
  //              não têm id (ex.: "Editar curso").
  //   avancar  → como o passo termina: 'click', 'change' ou 'manual'.
  //              Se omitido, é deduzido do tipo do elemento.
  //   navega   → clicar neste item TROCA DE TELA (e para qual). Permite ao
  //              planejador saber em que tela a pessoa estará no passo seguinte.
  //   abre     → clicar neste item ABRE esta janela (modal). Ver JANELAS.
  //   janela   → este item só existe dentro desta janela.
  //   fecha    → usar este item FECHA a janela (salvar, confirmar...).
  const ELEMENTOS = {}

  function definir(prefixo, pagina, itens) {
    for (const nome in itens) {
      const [seletor, rotulo, extra] = itens[nome]
      ELEMENTOS[prefixo + '.' + nome] = Object.assign({ pagina, seletor, rotulo }, extra)
    }
  }

  // "*" = existe em todas as páginas internas (menu lateral).
  definir('menu', '*', {
    abrir:       ['#menuBtn', 'Botão que abre o menu lateral (só aparece em telas pequenas)'],
    dashboard:   ['#sidebar a[href="DASHBOARD.HTML"]', 'Menu lateral "Dashboard": leva à tela Dashboard', { navega: 'DASHBOARD.HTML' }],
    alunos:      ['#sidebar a[href="ALUNOS.HTML"]', 'Menu lateral "Alunos": leva à tela Alunos', { navega: 'ALUNOS.HTML' }],
    cursos:      ['#sidebar a[href="CURSOS.HTML"]', 'Menu lateral "Cursos": leva à tela Cursos', { navega: 'CURSOS.HTML' }],
    turmas:      ['#sidebar a[href="TURMAS.HTML"]', 'Menu lateral "Turmas": leva à tela Turmas', { navega: 'TURMAS.HTML' }],
    documentos:  ['#sidebar a[href="DOCUMENTOS.HTML"]', 'Menu lateral "Documentos": leva à tela Documentos', { navega: 'DOCUMENTOS.HTML' }],
    grade:       ['#sidebar a[href="GRADE_HORARIA.HTML"]', 'Menu lateral "Grade Horária": leva à tela Grade Horária', { navega: 'GRADE_HORARIA.HTML' }],
    professores: ['#sidebar a[href="PROFESSORES.HTML"]', 'Menu lateral "Professores": leva à tela Professores', { navega: 'PROFESSORES.HTML' }],
    usuarios:    ['#sidebar a[href="USUARIOS.HTML"]', 'Menu lateral "Usuário e Permissões": leva à tela Usuário e Permissões', { navega: 'USUARIOS.HTML' }]
  })

  definir('dash', 'DASHBOARD.HTML', {
    alunos:      ['main article', 'Indicador "Alunos matriculados" (total de matrículas ativas)', { contem: 'Alunos matriculados' }],
    turmas:      ['main article', 'Indicador "Turmas ativas"', { contem: 'Turmas ativas' }],
    professores: ['main article', 'Indicador "Professores ativos"', { contem: 'Professores ativos' }],
    ocupacao:    ['main article', 'Indicador "Taxa de ocupação" (vagas preenchidas / disponíveis)', { contem: 'Taxa de ocupação' }],
    // Este link só existe no topo do Dashboard (não nas demais páginas).
    sair:        ['a[href="../index.html"]', 'Link "Voltar ao login" no topo do Dashboard']
  })

  definir('alunos', 'ALUNOS.HTML', {
    novo:               ['#novoAlunoBtn', 'Botão "Novo aluno": abre a janela de cadastro de aluno', { abre: 'alunos.form' }],
    busca:              ['#buscaInput', 'Campo de busca de alunos por nome, CPF ou e-mail'],
    filtroStatus:       ['#filtroStatus', 'Filtro da lista por status (Ativo/Inativo)'],
    total:              ['#totalAlunos', 'Contador de alunos encontrados'],
    lista:              ['#tableWrapper', 'Tabela com a lista de alunos cadastrados'],
    // Botões das linhas (criados pelo JS da tela). Identificados pelo title.
    btnEditar:          ['#tabelaAlunos button[title="Editar"]', 'Ícone de lápis na linha de um aluno: abre a janela de edição do aluno', { abre: 'alunos.form' }],
    btnExcluir:         ['#tabelaAlunos button[title="Excluir"]', 'Ícone de lixeira na linha de um aluno: abre a confirmação de exclusão', { abre: 'alunos.excluir' }],
    btnMatricular:      ['#tabelaAlunos button[title="Matricular em turma"]', 'Ícone de capelo na linha de um aluno: abre a janela de matrícula em turma', { abre: 'alunos.matricula' }],
    nome:               ['#nome', 'Campo Nome (janela do formulário de aluno)', { janela: 'alunos.form' }],
    cpf:                ['#cpf', 'Campo CPF (janela do formulário de aluno)', { janela: 'alunos.form' }],
    status:             ['#status', 'Campo Status Ativo/Inativo (janela do formulário de aluno)', { janela: 'alunos.form' }],
    email:              ['#email', 'Campo E-mail (janela do formulário de aluno)', { janela: 'alunos.form' }],
    salvar:             ['#submitBtn', 'Botão de salvar/cadastrar (janela do formulário de aluno)', { janela: 'alunos.form', fecha: true }],
    confirmarExcluir:   ['#confirmarExcluir', 'Botão "Excluir" que confirma a exclusão (janela de confirmação)', { janela: 'alunos.excluir', fecha: true }],
    matriculaCurso:     ['#matriculaCursoId', 'Seletor de curso (janela de matrícula)', { janela: 'alunos.matricula' }],
    matriculaTurma:     ['#matriculaTurmaId', 'Seletor de turma, só carrega depois de escolher o curso (janela de matrícula)', { janela: 'alunos.matricula' }],
    confirmarMatricula: ['#confirmarMatricula', 'Botão "Matricular" (janela de matrícula)', { janela: 'alunos.matricula', fecha: true }]
  })

  definir('cursos', 'CURSOS.HTML', {
    novo:        ['#novoCursoBtn', 'Botão "Novo curso": abre a janela de cadastro de curso', { abre: 'cursos.form' }],
    lista:       ['#cardsContainer', 'Lista de cursos cadastrados (um card por curso)'],
    btnEditar:   ['#cardsContainer button', 'Botão "Editar curso" no card de um curso: abre a janela de edição', { contem: 'Editar curso', abre: 'cursos.form' }],
    btnExcluir:  ['#cardsContainer button', 'Botão "Excluir curso" no card de um curso (o navegador pede confirmação)', { contem: 'Excluir curso' }],
    btnVerTurmas:['#cardsContainer a', 'Link "Ver turmas" no card de um curso: leva à tela Turmas filtrada por esse curso', { contem: 'Ver turmas', navega: 'TURMAS.HTML' }],
    nome:        ['#nome', 'Campo Nome do curso (janela do formulário de curso)', { janela: 'cursos.form' }],
    duracao:     ['#duracao', 'Campo Tempo de duração em horas (janela do formulário de curso)', { janela: 'cursos.form' }],
    salvar:      ['#cursoForm [type="submit"]', 'Botão de salvar o curso (janela do formulário de curso)', { janela: 'cursos.form', fecha: true }]
  })

  definir('turmas', 'TURMAS.HTML', {
    nova:         ['#novaTurmaBtn', 'Botão "Nova turma": abre a janela de cadastro de turma', { abre: 'turmas.form' }],
    filtroCurso:  ['#filtroCurso', 'Filtro da lista de turmas por curso'],
    lista:        ['#cardsContainer', 'Lista de turmas cadastradas (professor, horário, sala, vagas)'],
    btnExcluir:   ['#cardsContainer button', 'Botão "Excluir turma" no card de uma turma (o navegador pede confirmação)', { contem: 'Excluir turma' }],
    cursoId:      ['#curso_id', 'Campo Código (ID) do curso (janela de turma)', { janela: 'turmas.form' }],
    codigo:       ['#codigo', 'Campo Código da turma (janela de turma)', { janela: 'turmas.form' }],
    disciplina:   ['#disciplina', 'Campo Disciplina (janela de turma)', { janela: 'turmas.form' }],
    professorId:  ['#professor_id', 'Campo Código (ID) do professor (janela de turma)', { janela: 'turmas.form' }],
    dias:         ['#turmaForm fieldset', 'Dias da semana das aulas (janela de turma)', { janela: 'turmas.form' }],
    horaInicio:   ['#horaInicio', 'Campo horário de início (janela de turma)', { janela: 'turmas.form' }],
    horaFim:      ['#horaFim', 'Campo horário de término (janela de turma)', { janela: 'turmas.form' }],
    sala:         ['#sala', 'Campo Sala (janela de turma)', { janela: 'turmas.form' }],
    vagas:        ['#qtd_vagas_turmas', 'Campo Quantidade de vagas (janela de turma)', { janela: 'turmas.form' }],
    status:       ['#status', 'Campo Status Ativa/Encerrada (janela de turma)', { janela: 'turmas.form' }],
    salvar:       ['#turmaForm [type="submit"]', 'Botão "Criar turma" (janela de turma)', { janela: 'turmas.form', fecha: true }]
  })

  // Documentos de emissão imediata: um card + um modal compartilhado.
  // "id" = qual identificador o modal pede (muda conforme o documento).
  const DOCS_EMISSAO = [
    { tipo: 'curso',      titulo: 'Declaração de Curso',           id: 'ID do aluno' },
    { tipo: 'frequencia', titulo: 'Declaração de Frequência',      id: 'ID da matrícula' },
    { tipo: 'matricula',  titulo: 'Comprovante de Matrícula',      id: 'ID do aluno' },
    { tipo: 'vinculo',    titulo: 'Declaração de Vínculo Escolar', id: 'ID do aluno' },
    { tipo: 'historico',  titulo: 'Histórico de Frequência',       id: 'ID da matrícula' }
  ]

  definir('docs', 'DOCUMENTOS.HTML', {
    emissao:      ['#gridEmissao', 'Seção "Emissão imediata" com os cards de documentos'],
    solicitacoes: ['#gridSolicitacoes', 'Seção de documentos que exigem solicitação'],
    busca:        ['#buscaInput', 'Campo de busca de documentos'],
    id:           ['#idDeclaracaoInput', 'Campo de ID (do aluno ou da matrícula, conforme o documento) na janela do documento', { janela: 'docs.declaracao' }],
    buscar:       ['button[onclick="buscarDeclaracao()"]', 'Lupa que busca o aluno/matrícula pelo ID (janela do documento)', { janela: 'docs.declaracao' }],
    frequencia:   ['#frequenciaValor', 'Campo de frequência, calculado sozinho (só na Declaração de Frequência)', { avancar: 'manual', janela: 'docs.declaracao' }],
    gerarPdf:     ['#btnImprimir', 'Botão "Gerar PDF" (janela do documento)', { janela: 'docs.declaracao' }],
    cardCertificado: ['button[onclick="abrirModalCertificacao()"]', 'Card "Certificado de Conclusão": abre a janela de solicitação', { abre: 'docs.certificacao' }],
    certId:       ['#idAlunoCertInput', 'Campo ID do aluno (janela do certificado)', { janela: 'docs.certificacao' }],
    certBuscar:   ['button[onclick="buscarAlunoPorIdCert()"]', 'Lupa que busca o aluno (janela do certificado)', { janela: 'docs.certificacao' }],
    certObs:      ['#obsCert', 'Campo de observações (janela do certificado)', { janela: 'docs.certificacao' }],
    certEnviar:   ['#btnSolicitarCert', 'Botão "Enviar solicitação" (janela do certificado)', { janela: 'docs.certificacao', fecha: true }]
  })

  // Os cards de documento são parecidos: gerados em loop para não repetir.
  DOCS_EMISSAO.forEach(d => {
    ELEMENTOS['docs.card_' + d.tipo] = {
      pagina: 'DOCUMENTOS.HTML',
      seletor: 'button[onclick="abrirModalDeclaracao(\'' + d.tipo + '\')"]',
      rotulo: 'Card "' + d.titulo + '": abre a janela de emissão (pede o ' + d.id + ')',
      abre: 'docs.declaracao'
    }
  })

  definir('grade', 'GRADE_HORARIA.HTML', {
    atualizar:  ['#atualizar', 'Botão "Atualizar": recarrega a grade'],
    imprimir:   ['#imprimir', 'Botão "Imprimir": imprime a grade'],
    resumo:     ['#totalTurmas', 'Resumo com o total de turmas encontradas'],
    curso:      ['#curso', 'Filtro da grade por curso'],
    professor:  ['#professor', 'Filtro da grade por professor'],
    turno:      ['#turno', 'Filtro da grade por turno (manhã, tarde, noite)'],
    busca:      ['#busca', 'Busca na grade por disciplina ou código da turma'],
    grade:      ['#grade', 'Grade semanal de aulas, por dia e horário'],
    gerenciar:  ['header a[href="TURMAS.HTML"]', 'Botão "Gerenciar turmas": leva à tela Turmas', { navega: 'TURMAS.HTML' }]
  })

  definir('prof', 'PROFESSORES.HTML', {
    total:       ['#totalAtivos', 'Contador de professores ativos'],
    busca:       ['#buscaProfessor', 'Campo de busca de professor por nome'],
    lista:       ['#listaProfessores', 'Lista de professores cadastrados (nome, especialidade, nº de turmas)'],
    btnDetalhes: ['#listaProfessores button[data-professor]', 'Botão "Ver detalhes" no card de um professor: mostra os dados e as turmas dele'],
    detalhes:    ['#detalhesProfessor', 'Painel com os detalhes e as turmas do professor escolhido']
  })

  definir('usuarios', 'USUARIOS.HTML', {
    novo:          ['#novoUsuarioBtn', 'Botão "Novo usuário": abre a janela de cadastro de usuário', { abre: 'usuarios.form' }],
    busca:         ['#buscaInput', 'Campo de busca de usuários por nome, e-mail ou cargo'],
    tabela:        ['#tableWrapper', 'Tabela com os usuários cadastrados'],
    btnEditar:     ['#tabelaUsuarios button', 'Botão "Editar" na linha de um usuário: abre a janela de edição', { contem: 'Editar', abre: 'usuarios.form' }],
    nome:          ['#nome', 'Campo Nome completo (janela de usuário)', { janela: 'usuarios.form' }],
    email:         ['#email', 'Campo E-mail (janela de usuário)', { janela: 'usuarios.form' }],
    cargo:         ['#cargo', 'Seletor de cargo: desenvolvedor, diretoria, gerente, coordenador, professor, assistente (janela de usuário)', { janela: 'usuarios.form' }],
    telefone:      ['#telefone', 'Campo Telefone, só aparece com o cargo Professor (janela de usuário)', { janela: 'usuarios.form' }],
    especialidade: ['#especialidade', 'Campo Especialidade, só aparece com o cargo Professor (janela de usuário)', { janela: 'usuarios.form' }],
    senha:         ['#senha', 'Campo Senha, mínimo de 8 caracteres (janela de usuário)', { janela: 'usuarios.form' }],
    salvar:        ['#usuarioForm [type="submit"]', 'Botão de salvar/cadastrar usuário (janela de usuário)', { janela: 'usuarios.form', fecha: true }]
  })

  // 2.3.1 — JANELAS (modais). Servem para o planejador completar o caminho:
  // se um passo usa um campo de uma janela que ainda não foi aberta, o código
  // insere sozinho o clique que abre essa janela ("padrao").
  //   teste → um campo da janela; se ele já está visível agora, a janela já está aberta.
  const JANELAS = {
    'alunos.form':       { teste: 'alunos.nome',            padrao: 'alunos.novo',          texto: 'Clique em "Novo aluno" para abrir o formulário.' },
    'alunos.excluir':    { teste: 'alunos.confirmarExcluir', padrao: 'alunos.btnExcluir',    texto: 'Clique no ícone de lixeira na linha do aluno.' },
    'alunos.matricula':  { teste: 'alunos.matriculaCurso',  padrao: 'alunos.btnMatricular', texto: 'Clique no ícone de capelo (matricular) na linha do aluno.' },
    'cursos.form':       { teste: 'cursos.nome',            padrao: 'cursos.novo',          texto: 'Clique em "Novo curso" para abrir o formulário.' },
    'turmas.form':       { teste: 'turmas.cursoId',         padrao: 'turmas.nova',          texto: 'Clique em "Nova turma" para abrir o formulário.' },
    'usuarios.form':     { teste: 'usuarios.nome',          padrao: 'usuarios.novo',        texto: 'Clique em "Novo usuário" para abrir o formulário.' },
    'docs.certificacao': { teste: 'docs.certId',            padrao: 'docs.cardCertificado', texto: 'Clique no card "Certificado de Conclusão".' },
    // Sem "padrao": existem 5 cards de documento; só a IA sabe qual a pessoa quer.
    'docs.declaracao':   { teste: 'docs.id' }
  }

  // Nome amigável de cada tela, usado nas instruções de navegação.
  const NOME_PAGINA = {
    'DASHBOARD.HTML': 'Dashboard', 'ALUNOS.HTML': 'Alunos', 'CURSOS.HTML': 'Cursos',
    'TURMAS.HTML': 'Turmas', 'DOCUMENTOS.HTML': 'Documentos', 'GRADE_HORARIA.HTML': 'Grade Horária',
    'PROFESSORES.HTML': 'Professores', 'USUARIOS.HTML': 'Usuário e Permissões'
  }
  // Qual item do menu leva a cada tela.
  const MENU_DA_PAGINA = {
    'DASHBOARD.HTML': 'menu.dashboard', 'ALUNOS.HTML': 'menu.alunos', 'CURSOS.HTML': 'menu.cursos',
    'TURMAS.HTML': 'menu.turmas', 'DOCUMENTOS.HTML': 'menu.documentos', 'GRADE_HORARIA.HTML': 'menu.grade',
    'PROFESSORES.HTML': 'menu.professores', 'USUARIOS.HTML': 'menu.usuarios'
  }

  // 2.4 — ROTEIROS: fluxos completos, revisados à mão. Quando a IA reconhece
  // um deles, o passo a passo é EXATAMENTE este (sem improviso).
  //   passos   → [chave do elemento, instrução, modo opcional]
  //   palavras → frases usadas só no "modo básico" (se a IA estiver fora do ar)
  //   aviso    → mensagem extra mostrada antes de começar
  const ROTEIROS = {

    // ── ALUNOS ────────────────────────────────────────────────────────────
    aluno_cadastrar: {
      titulo: 'Cadastrar um aluno',
      descricao: 'cadastrar, criar, adicionar ou registrar um novo aluno',
      palavras: ['cadastrar aluno', 'novo aluno', 'criar aluno', 'adicionar aluno', 'registrar aluno', 'incluir aluno'],
      passos: [
        ['alunos.novo',   'Clique em "Novo aluno" para abrir o formulário de cadastro.'],
        ['alunos.nome',   'Digite o nome completo do aluno.'],
        ['alunos.cpf',    'Informe o CPF do aluno.'],
        ['alunos.status', 'Escolha o status do aluno: Ativo ou Inativo.'],
        ['alunos.email',  'Informe o e-mail do aluno.'],
        ['alunos.salvar', 'Clique em "Cadastrar Aluno" para concluir.']
      ]
    },
    aluno_buscar: {
      titulo: 'Buscar um aluno',
      descricao: 'buscar, procurar, encontrar ou pesquisar um aluno por nome, CPF ou e-mail; filtrar alunos por status',
      palavras: ['buscar aluno', 'procurar aluno', 'encontrar aluno', 'pesquisar aluno', 'filtrar aluno', 'achar aluno'],
      passos: [
        ['alunos.busca',        'Digite o nome, o CPF ou o e-mail do aluno. A tabela filtra enquanto você digita.'],
        ['alunos.filtroStatus', 'Se quiser, filtre por status (Ativo ou Inativo).'],
        ['alunos.lista',        'Os alunos encontrados aparecem aqui.', 'manual']
      ]
    },
    aluno_editar: {
      titulo: 'Editar um aluno',
      descricao: 'editar, alterar, atualizar ou corrigir os dados de um aluno já cadastrado',
      palavras: ['editar aluno', 'alterar aluno', 'atualizar aluno', 'corrigir aluno', 'modificar aluno', 'mudar dados aluno'],
      passos: [
        ['alunos.busca',     'Localize o aluno. Use a busca se a lista for grande.'],
        ['alunos.btnEditar', 'Clique no ícone de editar (lápis) na linha do aluno. Estou destacando o da primeira linha como exemplo.'],
        ['alunos.nome',      'Altere os dados que precisar no formulário.', 'manual'],
        ['alunos.salvar',    'Clique em "Salvar Alterações" para confirmar.']
      ]
    },
    aluno_excluir: {
      titulo: 'Excluir um aluno',
      descricao: 'excluir, apagar, deletar ou remover um aluno',
      palavras: ['excluir aluno', 'apagar aluno', 'deletar aluno', 'remover aluno'],
      passos: [
        ['alunos.busca',            'Localize o aluno que será excluído.'],
        ['alunos.btnExcluir',       'Clique no ícone de lixeira na linha do aluno. Estou destacando o da primeira linha como exemplo.'],
        ['alunos.confirmarExcluir', 'Confira o nome na janela e clique em "Excluir" para confirmar.']
      ]
    },
    aluno_matricular: {
      titulo: 'Matricular um aluno em uma turma',
      descricao: 'matricular, inscrever ou colocar um aluno em um curso/turma',
      palavras: ['matricular aluno', 'matricula aluno', 'inscrever aluno', 'colocar aluno turma', 'matricular turma', 'matricular curso'],
      passos: [
        ['alunos.busca',              'Localize o aluno que será matriculado.'],
        ['alunos.btnMatricular',      'Clique no ícone de capelo (matricular) na linha do aluno. Estou destacando o da primeira linha como exemplo.'],
        ['alunos.matriculaCurso',     'Escolha o curso.'],
        ['alunos.matriculaTurma',     'Escolha a turma (a lista aparece depois que o curso é escolhido).'],
        ['alunos.confirmarMatricula', 'Clique em "Matricular" para concluir.']
      ]
    },
    alunos_ver: {
      titulo: 'Ver a lista de alunos',
      descricao: 'ver, listar ou visualizar os alunos cadastrados; abrir a página de alunos',
      palavras: ['ver alunos', 'listar alunos', 'lista alunos', 'mostrar alunos', 'visualizar alunos', 'pagina alunos', 'total alunos'],
      passos: [
        ['alunos.lista', 'Esta é a lista de alunos cadastrados.', 'manual'],
        ['alunos.total', 'Aqui aparece quantos alunos foram encontrados.', 'manual'],
        ['alunos.busca', 'Use a busca para filtrar por nome, CPF ou e-mail.']
      ]
    },

    // ── CURSOS ────────────────────────────────────────────────────────────
    curso_cadastrar: {
      titulo: 'Cadastrar um curso',
      descricao: 'cadastrar, criar, adicionar ou registrar um novo curso',
      palavras: ['cadastrar curso', 'novo curso', 'criar curso', 'adicionar curso', 'registrar curso', 'incluir curso'],
      passos: [
        ['cursos.novo',    'Clique em "Novo curso" para abrir o formulário.'],
        ['cursos.nome',    'Digite o nome do curso.'],
        ['cursos.duracao', 'Informe o tempo de duração do curso, em horas.'],
        ['cursos.salvar',  'Clique em "Salvar curso" para concluir.']
      ]
    },
    curso_editar: {
      titulo: 'Editar um curso',
      descricao: 'editar, alterar ou atualizar o nome ou a duração de um curso',
      palavras: ['editar curso', 'alterar curso', 'atualizar curso', 'modificar curso', 'corrigir curso'],
      passos: [
        ['cursos.btnEditar', 'Clique em "Editar curso" no card do curso desejado. Estou destacando o primeiro como exemplo.'],
        ['cursos.nome',      'Altere o nome, se precisar.', 'manual'],
        ['cursos.duracao',   'Altere a duração, se precisar.', 'manual'],
        ['cursos.salvar',    'Clique em "Salvar alterações" para confirmar.']
      ]
    },
    curso_excluir: {
      titulo: 'Excluir um curso',
      descricao: 'excluir, apagar, deletar ou remover um curso',
      palavras: ['excluir curso', 'apagar curso', 'deletar curso', 'remover curso'],
      aviso: 'Atenção: ao excluir um curso, as turmas vinculadas a ele também são excluídas. O navegador vai pedir uma confirmação.',
      passos: [
        ['cursos.btnExcluir', 'Clique em "Excluir curso" no card do curso desejado e confirme na janela do navegador. Estou destacando o primeiro como exemplo.']
      ]
    },
    cursos_ver: {
      titulo: 'Ver os cursos cadastrados',
      descricao: 'ver, listar ou visualizar os cursos cadastrados; abrir a página de cursos',
      palavras: ['ver cursos', 'listar cursos', 'lista cursos', 'mostrar cursos', 'visualizar cursos', 'pagina cursos'],
      passos: [
        ['cursos.lista', 'Estes são os cursos cadastrados, com a duração de cada um.', 'manual'],
        ['cursos.novo',  'Para criar outro curso, use este botão.']
      ]
    },
    curso_ver_turmas: {
      titulo: 'Ver as turmas de um curso',
      descricao: 'ver ou abrir as turmas de um curso específico',
      palavras: ['turmas do curso', 'ver turmas curso', 'turmas de um curso', 'abrir turmas curso'],
      passos: [
        ['cursos.btnVerTurmas', 'Clique em "Ver turmas" no card do curso. Estou destacando o primeiro como exemplo.'],
        ['turmas.lista',        'Estas são as turmas do curso escolhido.', 'manual']
      ]
    },

    // ── TURMAS ────────────────────────────────────────────────────────────
    turma_cadastrar: {
      titulo: 'Cadastrar uma turma',
      descricao: 'cadastrar, criar, adicionar ou abrir uma nova turma para um curso',
      palavras: ['cadastrar turma', 'nova turma', 'criar turma', 'adicionar turma', 'registrar turma', 'abrir turma', 'incluir turma'],
      aviso: 'Dica: tenha em mãos o código (ID) do curso e do professor. Os nomes aparecem sozinhos depois que você digita o código.',
      passos: [
        ['turmas.nova',        'Clique em "Nova turma" para abrir o formulário.'],
        ['turmas.cursoId',     'Digite o código (ID) do curso. O nome dele aparece ao lado.'],
        ['turmas.codigo',      'Digite o código da turma.'],
        ['turmas.disciplina',  'Informe a disciplina.'],
        ['turmas.professorId', 'Digite o código (ID) do professor responsável.'],
        ['turmas.dias',        'Marque os dias da semana em que haverá aula e clique em Avançar.'],
        ['turmas.horaInicio',  'Informe o horário de início das aulas.'],
        ['turmas.horaFim',     'Informe o horário de término das aulas.'],
        ['turmas.sala',        'Informe a sala. Exemplo: Bloco A - Sala 12.'],
        ['turmas.vagas',       'Informe a quantidade de vagas.'],
        ['turmas.status',      'Escolha o status da turma: Ativa ou Encerrada.'],
        ['turmas.salvar',      'Clique em "Criar turma" para concluir.']
      ]
    },
    turma_excluir: {
      titulo: 'Excluir uma turma',
      descricao: 'excluir, apagar, deletar ou remover uma turma',
      palavras: ['excluir turma', 'apagar turma', 'deletar turma', 'remover turma'],
      aviso: 'O navegador vai pedir uma confirmação antes de excluir.',
      passos: [
        ['turmas.filtroCurso', 'Se quiser, filtre pelo curso da turma.'],
        ['turmas.btnExcluir',  'Clique em "Excluir turma" no card da turma desejada e confirme. Estou destacando o primeiro como exemplo.']
      ]
    },
    turmas_ver: {
      titulo: 'Ver as turmas cadastradas',
      descricao: 'ver, listar ou filtrar as turmas cadastradas; abrir a página de turmas',
      palavras: ['ver turmas', 'listar turmas', 'lista turmas', 'mostrar turmas', 'visualizar turmas', 'pagina turmas', 'filtrar turmas'],
      passos: [
        ['turmas.filtroCurso', 'Escolha um curso para ver só as turmas dele, ou deixe "Todos os cursos".'],
        ['turmas.lista',       'As turmas aparecem aqui, com professor, horário, sala e vagas.', 'manual']
      ]
    },

    // ── DOCUMENTOS ────────────────────────────────────────────────────────
    docs_ver: {
      titulo: 'Ver os documentos disponíveis',
      descricao: 'ver quais documentos podem ser emitidos; abrir a página de documentos',
      palavras: ['ver documentos', 'listar documentos', 'quais documentos', 'pagina documentos', 'tipos documentos', 'emitir documento'],
      passos: [
        ['docs.emissao',      'Aqui estão os documentos de emissão imediata (declarações e comprovantes).', 'manual'],
        ['docs.solicitacoes', 'Aqui ficam os documentos que exigem solicitação, como o certificado de conclusão.', 'manual']
      ]
    },
    doc_certificado: {
      titulo: 'Solicitar certificado de conclusão',
      descricao: 'solicitar ou emitir o certificado de conclusão de curso de um aluno',
      palavras: ['certificado conclusao', 'certificado', 'solicitar certificado', 'emitir certificado', 'diploma'],
      passos: [
        ['docs.cardCertificado', 'Clique no card "Certificado de Conclusão".'],
        ['docs.certId',          'Digite o ID do aluno.'],
        ['docs.certBuscar',      'Clique na lupa para buscar o aluno.'],
        ['docs.certObs',         'Se precisar, escreva uma observação.', 'manual'],
        ['docs.certEnviar',      'Clique em "Enviar solicitação" para concluir.']
      ]
    }
  }

  // Os 5 documentos de emissão seguem o mesmo roteiro (card → ID → lupa → PDF).
  // Gerados em loop para manter os textos idênticos e fáceis de manter.
  DOCS_EMISSAO.forEach(d => {
    const passos = [
      ['docs.card_' + d.tipo, 'Clique no card "' + d.titulo + '" para abrir a janela de emissão.'],
      ['docs.id',             'Digite o ' + d.id + '.'],
      ['docs.buscar',         'Clique na lupa (ou pressione Enter) para buscar. Os dados encontrados aparecem na janela.']
    ]
    if (d.tipo === 'frequencia') {
      passos.push(['docs.frequencia', 'A frequência é calculada automaticamente com base nos registros. Não precisa digitar.', 'manual'])
    }
    passos.push(['docs.gerarPdf', 'Clique em "Gerar PDF" para emitir o documento.'])

    const nome = d.titulo.toLowerCase()
    const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    ROTEIROS['doc_' + d.tipo] = {
      titulo: 'Emitir ' + d.titulo,
      descricao: 'emitir, gerar ou imprimir "' + d.titulo + '" (usa o ' + d.id + ')',
      palavras: [semAcento, 'emitir ' + semAcento, 'gerar ' + semAcento],
      passos
    }
  })

  // Palavras extras para facilitar o modo básico dos documentos mais pedidos.
  ROTEIROS.doc_curso.palavras.push('declaracao curso', 'declaracao estudo', 'declaracao aluno')
  ROTEIROS.doc_frequencia.palavras.push('declaracao frequencia', 'frequencia aluno', 'presenca aluno')
  ROTEIROS.doc_matricula.palavras.push('comprovante matricula', 'comprovante aluno')
  ROTEIROS.doc_vinculo.palavras.push('declaracao vinculo', 'vinculo escolar')
  ROTEIROS.doc_historico.palavras.push('historico frequencia', 'historico presenca', 'faltas aluno')

  Object.assign(ROTEIROS, {

    // ── GRADE HORÁRIA ─────────────────────────────────────────────────────
    grade_ver: {
      titulo: 'Ver a grade horária',
      descricao: 'ver, abrir ou visualizar a grade horária semanal de aulas',
      palavras: ['ver grade', 'grade horaria', 'horario aulas', 'horarios aulas', 'abrir grade', 'agenda aulas', 'quadro horarios'],
      passos: [
        ['grade.resumo', 'Aqui aparece o total de turmas encontradas.', 'manual'],
        ['grade.grade',  'Esta é a grade da semana, organizada por dia e horário.', 'manual']
      ]
    },
    grade_filtrar: {
      titulo: 'Filtrar a grade horária',
      descricao: 'filtrar ou buscar na grade horária por curso, professor, turno, disciplina ou turma',
      palavras: ['filtrar grade', 'buscar grade', 'procurar grade', 'grade curso', 'grade professor', 'grade turno', 'grade sala'],
      passos: [
        ['grade.curso',     'Escolha um curso para ver só as turmas dele.'],
        ['grade.professor', 'Escolha um professor, se quiser.'],
        ['grade.turno',     'Escolha o turno: manhã, tarde ou noite.'],
        ['grade.busca',     'Ou digite uma disciplina ou código de turma.'],
        ['grade.grade',     'A grade é atualizada conforme você muda os filtros.', 'manual']
      ]
    },
    grade_imprimir: {
      titulo: 'Imprimir a grade horária',
      descricao: 'imprimir a grade horária',
      palavras: ['imprimir grade', 'impressao grade', 'imprimir horarios'],
      passos: [
        ['grade.curso',    'Se quiser imprimir só um curso, filtre antes por aqui.', 'manual'],
        ['grade.imprimir', 'Clique em "Imprimir" para abrir a impressão da grade.']
      ]
    },
    grade_atualizar: {
      titulo: 'Atualizar a grade horária',
      descricao: 'atualizar ou recarregar os dados da grade horária',
      palavras: ['atualizar grade', 'recarregar grade'],
      passos: [
        ['grade.atualizar', 'Clique em "Atualizar" para recarregar a grade com os dados mais recentes.']
      ]
    },

    // ── PROFESSORES ───────────────────────────────────────────────────────
    professores_ver: {
      titulo: 'Ver os professores',
      descricao: 'ver, listar ou visualizar os professores; abrir a página de professores',
      palavras: ['ver professores', 'listar professores', 'lista professores', 'mostrar professores', 'corpo docente', 'pagina professores'],
      passos: [
        ['prof.total', 'Aqui aparece quantos professores estão ativos.', 'manual'],
        ['prof.lista', 'Estes são os professores, com a especialidade e a quantidade de turmas de cada um.', 'manual']
      ]
    },
    professor_buscar: {
      titulo: 'Buscar um professor',
      descricao: 'buscar, procurar ou encontrar um professor pelo nome',
      palavras: ['buscar professor', 'procurar professor', 'encontrar professor', 'pesquisar professor', 'achar professor'],
      passos: [
        ['prof.busca', 'Digite o nome do professor. A lista filtra enquanto você digita.'],
        ['prof.lista', 'Os professores encontrados aparecem aqui.', 'manual']
      ]
    },
    professor_detalhes: {
      titulo: 'Ver os detalhes de um professor',
      descricao: 'ver detalhes, turmas ou informações de um professor específico',
      palavras: ['detalhes professor', 'turmas professor', 'dados professor', 'informacoes professor'],
      passos: [
        ['prof.busca',       'Se precisar, busque o professor pelo nome.', 'manual'],
        ['prof.btnDetalhes', 'Clique em "Ver detalhes" no card do professor. Estou destacando o primeiro como exemplo.'],
        ['prof.detalhes',    'Aqui estão os dados do professor e as turmas vinculadas.', 'manual']
      ]
    },

    // ── USUÁRIOS ──────────────────────────────────────────────────────────
    usuario_cadastrar: {
      titulo: 'Cadastrar um usuário',
      descricao: 'cadastrar, criar ou adicionar um usuário do sistema com cargo (desenvolvedor, diretoria, gerente, coordenador, assistente)',
      palavras: ['cadastrar usuario', 'novo usuario', 'criar usuario', 'adicionar usuario', 'incluir usuario', 'permissoes', 'dar acesso', 'criar conta'],
      aviso: 'Nesta versão, os usuários cadastrados ficam em uma prévia da sessão do navegador.',
      passos: [
        ['usuarios.novo',  'Clique em "Novo usuário" para abrir o formulário.'],
        ['usuarios.nome',  'Digite o nome completo.'],
        ['usuarios.email', 'Informe o e-mail.'],
        ['usuarios.cargo', 'Escolha o cargo do usuário.'],
        ['usuarios.senha', 'Defina uma senha com pelo menos 8 caracteres.'],
        ['usuarios.salvar','Clique em "Cadastrar usuário" para concluir.']
      ]
    },
    usuario_cadastrar_professor: {
      titulo: 'Cadastrar um professor',
      descricao: 'cadastrar, criar ou adicionar um novo professor (feito em Usuário e Permissões com o cargo Professor)',
      palavras: ['cadastrar professor', 'novo professor', 'criar professor', 'adicionar professor', 'incluir professor', 'registrar professor'],
      aviso: 'A página Professores é só de consulta. Um professor novo é cadastrado em "Usuário e Permissões" com o cargo "Professor". Nesta versão esse cadastro fica em uma prévia da sessão do navegador.',
      passos: [
        ['usuarios.novo',          'Clique em "Novo usuário" para abrir o formulário.'],
        ['usuarios.nome',          'Digite o nome completo do professor.'],
        ['usuarios.email',         'Informe o e-mail.'],
        ['usuarios.cargo',         'Escolha o cargo "Professor". Os campos Telefone e Especialidade vão aparecer.'],
        ['usuarios.telefone',      'Informe o telefone do professor.'],
        ['usuarios.especialidade', 'Informe a especialidade (a área em que ele leciona).'],
        ['usuarios.senha',         'Defina uma senha com pelo menos 8 caracteres.'],
        ['usuarios.salvar',        'Clique em "Cadastrar usuário" para concluir.']
      ]
    },
    usuario_editar: {
      titulo: 'Editar um usuário',
      descricao: 'editar ou alterar os dados, o cargo ou a senha de um usuário do sistema',
      palavras: ['editar usuario', 'alterar usuario', 'atualizar usuario', 'mudar cargo', 'trocar senha', 'alterar senha', 'alterar cargo'],
      passos: [
        ['usuarios.busca',     'Localize o usuário. Pode buscar por nome, e-mail ou cargo.'],
        ['usuarios.btnEditar', 'Clique em "Editar" na linha do usuário. Estou destacando o da primeira linha como exemplo.'],
        ['usuarios.nome',      'Altere os dados que precisar.', 'manual'],
        ['usuarios.salvar',    'Clique em "Salvar alterações" para confirmar.']
      ]
    },
    usuarios_ver: {
      titulo: 'Ver os usuários do sistema',
      descricao: 'ver, listar ou buscar os usuários do sistema; abrir a página de usuário e permissões',
      palavras: ['ver usuarios', 'listar usuarios', 'lista usuarios', 'pagina usuarios', 'buscar usuario', 'procurar usuario'],
      passos: [
        ['usuarios.busca',  'Busque por nome, e-mail ou cargo.'],
        ['usuarios.tabela', 'Os usuários cadastrados aparecem aqui.', 'manual']
      ]
    },

    // ── DASHBOARD / GERAL ─────────────────────────────────────────────────
    dashboard_ver: {
      titulo: 'Ver o dashboard',
      descricao: 'ver o dashboard, a visão geral, os indicadores, totais, estatísticas ou números do sistema (alunos matriculados, turmas ativas, professores ativos, taxa de ocupação)',
      palavras: ['ver dashboard', 'abrir dashboard', 'visao geral', 'indicadores', 'estatisticas', 'totais', 'taxa ocupacao', 'resumo sistema', 'quantos alunos', 'quantas turmas'],
      passos: [
        ['dash.alunos',      'Total de alunos matriculados.', 'manual'],
        ['dash.turmas',      'Total de turmas ativas.', 'manual'],
        ['dash.professores', 'Total de professores ativos.', 'manual'],
        ['dash.ocupacao',    'Taxa de ocupação: vagas preenchidas em relação às disponíveis.', 'manual']
      ]
    },
    sistema_sair: {
      titulo: 'Voltar para a tela de login',
      descricao: 'sair do sistema ou voltar para a tela de login',
      palavras: ['sair sistema', 'voltar login', 'tela login', 'deslogar', 'logout', 'fazer logoff'],
      passos: [
        ['dash.sair', 'Clique em "Voltar ao login" para sair desta área.']
      ]
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 3. UTILITÁRIOS
  // ══════════════════════════════════════════════════════════════════════════

  // Minúsculas, sem acento e sem pontuação: base para comparar textos.
  const normalizar = s => String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const limitar = (n, min, max) => Math.max(min, Math.min(max, n))

  // Nome do arquivo da página atual, em maiúsculas (ex.: "ALUNOS.HTML").
  function paginaAtual() {
    let arquivo = location.pathname.split('/').pop() || ''
    try { arquivo = decodeURIComponent(arquivo) } catch (e) { /* mantém como está */ }
    return arquivo.toUpperCase()
  }

  // O elemento realmente aparece na tela? (display/visibility e tamanho)
  // Modais escondidos com a classe "hidden" do Tailwind retornam false aqui,
  // por isso o guia espera o modal abrir antes de destacar os campos dele.
  function renderizavel(el) {
    if (!el || !el.isConnected) return false
    const estilo = getComputedStyle(el)
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return false
    return el.getClientRects().length > 0
  }

  // Encontra o primeiro elemento VISÍVEL que casa com a definição do catálogo.
  function resolverElemento(def) {
    let candidatos
    try { candidatos = Array.from(document.querySelectorAll(def.seletor)) } catch (e) { return null }

    if (def.contem) {
      const alvo = normalizar(def.contem)
      candidatos = candidatos.filter(el => normalizar(el.textContent).includes(alvo))
    }
    return candidatos.find(renderizavel) || null
  }

  // Aguarda o elemento aparecer (modal abrindo, tabela carregando da API...).
  // Resolve com o elemento ou null se o tempo esgotar.
  function esperarElemento(def, limite = ESPERA_ELEMENTO_MS) {
    return new Promise(resolve => {
      const inicio = Date.now()
      ;(function tentar() {
        const el = resolverElemento(def)
        if (el) return resolve(el)
        if (Date.now() - inicio >= limite) return resolve(null)
        setTimeout(tentar, 150)
      })()
    })
  }

  // Menu lateral está recolhido (celular)? Ele fica fora da tela à esquerda.
  function menuFechado() {
    const menu = document.getElementById('sidebar')
    return !!menu && menu.getBoundingClientRect().right <= 1
  }

  // O clique neste elemento troca de página sozinho? (link de verdade)
  function ehLinkDeNavegacao(el) {
    if (!el || el.tagName !== 'A') return false
    const href = el.getAttribute('href')
    return !!href && href !== '#' && !href.startsWith('javascript') && el.target !== '_blank'
  }

  // Como um passo termina, quando o roteiro não diz explicitamente:
  //   botão/link → quando a pessoa clica
  //   campo/seleção editável → quando a pessoa termina de preencher ("change")
  //   qualquer outra coisa (tabela, card, seção) → botão "Avançar"
  function avancarPadrao(el) {
    const tag = el.tagName
    if (tag === 'BUTTON' || tag === 'A') return 'click'
    if (tag === 'SELECT' || tag === 'TEXTAREA') return 'change'
    if (tag === 'INPUT') {
      const tipo = (el.type || '').toLowerCase()
      if (tipo === 'button' || tipo === 'submit') return 'click'
      if (el.readOnly || el.disabled) return 'manual'
      return 'change'
    }
    return 'manual'
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 3.1 PLANEJADOR DE CAMINHO
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A IA (ou um roteiro) diz O QUE a pessoa deve fazer. Este trecho completa o
  // COMO CHEGAR LÁ, de forma determinística, para o agente ENSINAR o trajeto
  // em vez de pular direto para a tela:
  //
  //   1. Se o próximo passo é em outra tela, insere um passo destacando o item
  //      do MENU LATERAL que leva até ela ("clique em Professores no menu").
  //      Se a tela anterior já levou até lá por um link (ex.: "Ver turmas"),
  //      não insere nada.
  //   2. Se o passo usa um campo de uma JANELA (modal) que ainda não foi aberta,
  //      insere o clique que abre a janela ("clique em Novo aluno").
  //
  // Assim, mesmo quando a IA esquece de mencionar a navegação, o caminho sai
  // completo e na ordem em que a pessoa realmente precisa fazer.

  function janelasAbertasAgora() {
    const abertas = new Set()
    for (const nome in JANELAS) {
      const teste = ELEMENTOS[JANELAS[nome].teste]
      if (teste && (teste.pagina === '*' || teste.pagina === paginaAtual()) && resolverElemento(teste)) abertas.add(nome)
    }
    return abertas
  }

  function completarPassos(entrada) {
    const saida = []
    let pagina = paginaAtual()
    let abertas = janelasAbertasAgora()
    let anterior = null

    for (const passo of entrada) {
      const def = ELEMENTOS[passo.el]
      if (!def) continue

      // 1) Troca de tela: ensina o caminho pelo menu.
      if (def.pagina !== '*' && def.pagina !== pagina) {
        const chegouPorLink = anterior && ELEMENTOS[anterior.el].navega === def.pagina
        const chaveMenu = MENU_DA_PAGINA[def.pagina]
        if (!chegouPorLink && chaveMenu) {
          saida.push({
            el: chaveMenu,
            texto: 'Primeiro, vamos até a tela "' + NOME_PAGINA[def.pagina] + '": clique em "' + NOME_PAGINA[def.pagina] + '" no menu lateral.',
            nav: def.pagina
          })
        }
        pagina = def.pagina
        abertas = new Set()
      }

      // 2) Janela (modal) que precisa estar aberta para este passo.
      if (def.janela && !abertas.has(def.janela)) {
        const janela = JANELAS[def.janela]
        if (janela && janela.padrao) {
          saida.push({ el: janela.padrao, texto: janela.texto })
          abertas.add(def.janela)
        }
      }

      saida.push(passo)
      anterior = passo

      // Atualiza o que a tela passa a mostrar depois deste passo.
      if (def.abre) abertas.add(def.abre)
      if (def.fecha && def.janela) abertas.delete(def.janela)
      if (def.navega) { pagina = def.navega; abertas = new Set() }
    }
    return saida
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. MODO BÁSICO (só quando a IA está fora do ar)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // É um RECURSO DE EMERGÊNCIA, bem mais limitado que a IA. Só é usado se o
  // servidor/IA não responder, e a pessoa é sempre avisada disso.
  //
  // Para não confundir pedidos, ele primeiro descobre a AÇÃO da frase
  // (criar, ver, editar, excluir, buscar, emitir) e só considera fluxos da
  // mesma ação. Assim "lista de professores CADASTRADOS" (ver) nunca vira
  // "CADASTRAR professor" (criar).

  const radical = t => t.slice(0, 5)

  const SINONIMOS = { vejo: 'ver', veja: 'ver', vendo: 'ver', enxergo: 'ver' }

  const ACOES = {
    criar:   ['cadas', 'criar', 'novo', 'nova', 'adici', 'inclu', 'regis', 'matri', 'inscr'],
    ver:     ['ver', 'lista', 'mostr', 'visua', 'consu', 'quais', 'onde'],
    editar:  ['edita', 'alter', 'atual', 'corri', 'modif', 'mudar', 'troca'],
    excluir: ['exclu', 'apaga', 'delet', 'remov'],
    buscar:  ['busca', 'procu', 'pesqu', 'encon', 'filtr', 'achar'],
    emitir:  ['emiti', 'gerar', 'impri']
  }

  // Qual ação cada roteiro representa (deduzida do nome da chave).
  function acaoDoRoteiro(chave) {
    if (/cadastrar|matricular/.test(chave)) return 'criar'
    if (/editar/.test(chave)) return 'editar'
    if (/excluir/.test(chave)) return 'excluir'
    if (/buscar|filtrar/.test(chave)) return 'buscar'
    if (/(^|_)ver|detalhes/.test(chave)) return 'ver'
    if (/^doc_|imprimir/.test(chave)) return 'emitir'
    return null
  }

  function identificarLocal(mensagem) {
    const palavras = normalizar(mensagem).split(' ').filter(Boolean)
      // "cadastrados/cadastradas" é adjetivo (já existem), não um pedido de cadastro.
      .filter(w => !/^cadastr.*(ados?|adas?)$/.test(w))
      .map(w => SINONIMOS[w] || w)
    const radicais = new Set(palavras.map(radical))

    const acoesDaFrase = Object.keys(ACOES).filter(a => ACOES[a].some(r => radicais.has(r)))
    let melhor = null
    let melhorPontos = 0

    for (const chave in ROTEIROS) {
      // Ação diferente da pedida? Descarta (ver ≠ cadastrar).
      const acao = acaoDoRoteiro(chave)
      if (acoesDaFrase.length && acao && !acoesDaFrase.includes(acao)) continue

      for (const frase of ROTEIROS[chave].palavras || []) {
        const partes = normalizar(frase).split(' ').filter(Boolean)
        if (partes.length && partes.every(p => radicais.has(radical(p)))) {
          // Frases mais longas e específicas valem mais pontos.
          const pontos = partes.reduce((soma, p) => soma + p.length, 0)
          if (pontos > melhorPontos) { melhorPontos = pontos; melhor = chave }
        }
      }
    }
    return melhor
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CSS (todas as regras começam com #ajuda-/.ajuda- para não colidir
  //    com o Tailwind nem com o CSS das páginas)
  // ══════════════════════════════════════════════════════════════════════════

  const css = `
    #ajuda-widget, #ajuda-painel, #ajuda-spot, #ajuda-tip, #ajuda-barra { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
    #ajuda-widget *, #ajuda-painel *, #ajuda-barra * { box-sizing: border-box; font-family: inherit; }

    /* Durante o guia, o ícone e o painel somem para não cobrir os destaques */
    body.ajuda-em-guia #ajuda-widget,
    body.ajuda-em-guia #ajuda-painel { display: none !important; }

    /* ── Ícone flutuante (arrastável) ───────────────────────────────── */
    #ajuda-widget { position: fixed; z-index: 2147483000; width: ${TAMANHO_BOTAO}px; height: ${TAMANHO_BOTAO}px; }
    #ajuda-btn {
      width: 100%; height: 100%; border-radius: 50%; border: none; padding: 0;
      background: #07224f; color: #fff; cursor: grab;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(7,34,79,.4);
      transition: box-shadow .2s, transform .2s;
      touch-action: none;            /* no celular, o arrasto não rola a página */
      user-select: none; -webkit-user-select: none;
    }
    #ajuda-btn:hover { box-shadow: 0 6px 24px rgba(7,34,79,.5); transform: scale(1.06); }
    #ajuda-btn.arrastando { cursor: grabbing; transform: scale(1.1); transition: none; }
    #ajuda-btn:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }

    /* ── Painel de conversa ─────────────────────────────────────────── */
    #ajuda-painel {
      position: fixed; z-index: 2147483001;
      width: min(340px, calc(100vw - 24px));
      background: #fff; border-radius: 16px; overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column;
      transition: opacity .2s, transform .2s, visibility 0s;
    }
    #ajuda-painel.fechado { opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(10px); transition: opacity .2s, transform .2s, visibility 0s .2s; }
    #ajuda-painel.aberto  { opacity: 1; visibility: visible; transform: translateY(0); }

    #ajuda-header { background: #07224f; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    #ajuda-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; color: #fff; }
    #ajuda-header p { margin: 0; color: #fff; }
    #ajuda-header .nome { font-size: 13px; font-weight: 600; }
    #ajuda-header .sub  { font-size: 10px; opacity: .7; }
    #ajuda-fechar { background: none; border: none; color: rgba(255,255,255,.75); cursor: pointer; padding: 4px; line-height: 1; }
    #ajuda-fechar:hover { color: #fff; }

    #ajuda-msgs { flex: 1 1 auto; min-height: 80px; max-height: 280px; overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 10px; }
    .ajuda-msg-bot, .ajuda-msg-user { max-width: 88%; padding: 10px 13px; border-radius: 12px; font-size: 13px; line-height: 1.55; white-space: pre-line; word-wrap: break-word; }
    .ajuda-msg-bot  { background: #f3f4f6; color: #1f2937; align-self: flex-start; border-bottom-left-radius: 3px; }
    .ajuda-msg-user { background: #07224f; color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
    .ajuda-msg-loading { background: #f3f4f6; align-self: flex-start; padding: 10px 14px; border-radius: 12px; border-bottom-left-radius: 3px; }
    .ajuda-pontos span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; margin: 0 2px; animation: ajuda-pulo 1.2s infinite; }
    .ajuda-pontos span:nth-child(2) { animation-delay: .2s; }
    .ajuda-pontos span:nth-child(3) { animation-delay: .4s; }
    @keyframes ajuda-pulo { 0%,80%,100% { transform: translateY(0) } 40% { transform: translateY(-6px) } }

    .ajuda-sugestoes { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; }
    .ajuda-chip { background: #fff; color: #07224f; border: 1.5px solid #d6deec; border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
    .ajuda-chip:hover { background: #eef2fa; border-color: #07224f; }

    #ajuda-confirma { display: none; flex-direction: column; gap: 10px; padding: 12px 14px; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
    #ajuda-confirma-txt { margin: 0; font-size: 13px; color: #1f2937; line-height: 1.55; font-weight: 500; }
    .ajuda-confirma-btns { display: flex; gap: 8px; }
    .ajuda-btn-sim { flex: 1; background: #07224f; color: #fff; border: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .ajuda-btn-sim:hover { opacity: .88; }
    .ajuda-btn-nao { flex: 1; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer; }
    .ajuda-btn-nao:hover { background: #e5e7eb; }

    #ajuda-entrada { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
    #ajuda-input { flex: 1; min-width: 0; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: none; color: #1f2937; background: #fff; }
    #ajuda-input:focus { border-color: #07224f; }
    #ajuda-input:disabled { background: #f9fafb; cursor: not-allowed; }
    #ajuda-enviar { width: 36px; height: 36px; flex-shrink: 0; border: none; border-radius: 8px; background: #07224f; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    #ajuda-enviar:hover { opacity: .88; }
    #ajuda-enviar:disabled { opacity: .45; cursor: not-allowed; }

    /* ── Guia visual ────────────────────────────────────────────────── */
    /* O destaque é uma caixa SEPARADA desenhada sobre o elemento. Assim não
       alteramos o CSS dos elementos da página (position, z-index etc.), o que
       poderia quebrar o layout. A "sombra gigante" escurece o resto da tela;
       pointer-events:none deixa os cliques passarem para a página. */
    #ajuda-spot {
      position: fixed; z-index: 2147482990; display: none; pointer-events: none; border-radius: 10px;
      box-shadow: 0 0 0 3px #2563eb, 0 0 0 9999px rgba(7,34,79,.38);
      animation: ajuda-destaque 1.6s ease-in-out infinite;
    }
    @keyframes ajuda-destaque {
      0%,100% { box-shadow: 0 0 0 3px #2563eb, 0 0 0 9999px rgba(7,34,79,.38); }
      50%     { box-shadow: 0 0 0 7px rgba(37,99,235,.5), 0 0 0 9999px rgba(7,34,79,.38); }
    }
    @media (prefers-reduced-motion: reduce) { #ajuda-spot { animation: none; } }

    #ajuda-tip {
      position: fixed; z-index: 2147482995; display: none; pointer-events: none;
      background: #07224f; color: #fff; padding: 10px 14px; border-radius: 10px;
      font-size: 13px; line-height: 1.55; width: max-content; max-width: min(300px, calc(100vw - 20px));
      box-shadow: 0 4px 20px rgba(0,0,0,.25); white-space: pre-line;
    }
    #ajuda-tip::after { content: ''; position: absolute; left: var(--seta, 20px); border: 7px solid transparent; display: none; }
    #ajuda-tip.cima::after  { display: block; bottom: -14px; border-top-color: #07224f; }
    #ajuda-tip.baixo::after { display: block; top: -14px; border-bottom-color: #07224f; }

    #ajuda-barra {
      position: fixed; left: 50%; transform: translateX(-50%); bottom: 16px; z-index: 2147482999;
      display: none; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px;
      width: max-content; max-width: calc(100vw - 20px);
      background: #07224f; color: #fff; padding: 10px 16px; border-radius: 24px;
      font-size: 13px; box-shadow: 0 4px 20px rgba(0,0,0,.25);
    }
    #ajuda-barra.topo { bottom: auto; top: 12px; }
    body.ajuda-em-guia #ajuda-barra { display: flex; }
    #ajuda-barra-passo { font-weight: 600; }
    #ajuda-barra-dica  { font-size: 11px; opacity: .8; }
    .ajuda-barra-btn { background: rgba(255,255,255,.15); color: #fff; border: none; border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
    .ajuda-barra-btn:hover:not(:disabled) { background: rgba(255,255,255,.28); }
    .ajuda-barra-btn:disabled { opacity: .35; cursor: not-allowed; }
  `

  const estilo = document.createElement('style')
  estilo.id = 'ajuda-estilo'
  estilo.textContent = css
  document.head.appendChild(estilo)

  // ══════════════════════════════════════════════════════════════════════════
  // 6. HTML DO WIDGET
  // ══════════════════════════════════════════════════════════════════════════

  document.body.insertAdjacentHTML('beforeend', `
    <div id="ajuda-spot"></div>
    <div id="ajuda-tip" role="status"></div>

    <div id="ajuda-barra" role="region" aria-label="Guia passo a passo">
      <span id="ajuda-barra-passo"></span>
      <span id="ajuda-barra-dica"></span>
      <button type="button" class="ajuda-barra-btn" id="ajuda-voltar">← Voltar</button>
      <button type="button" class="ajuda-barra-btn" id="ajuda-avancar">Avançar →</button>
      <button type="button" class="ajuda-barra-btn" id="ajuda-cancelar">Cancelar</button>
    </div>

    <div id="ajuda-widget">
      <button type="button" id="ajuda-btn" aria-label="Abrir assistente" aria-expanded="false" title="Assistente SICEP (arraste para mover)">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
    </div>

    <div id="ajuda-painel" class="fechado" role="dialog" aria-label="Assistente SICEP">
      <div id="ajuda-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div id="ajuda-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
            </svg>
          </div>
          <div>
            <p class="nome">Assistente SICEP</p>
            <p class="sub">Powered by Groq</p>
          </div>
        </div>
        <button type="button" id="ajuda-fechar" aria-label="Fechar assistente">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div id="ajuda-msgs" aria-live="polite"></div>

      <div id="ajuda-confirma">
        <p id="ajuda-confirma-txt"></p>
        <div class="ajuda-confirma-btns">
          <button type="button" class="ajuda-btn-sim" id="ajuda-sim">Sim, pode guiar!</button>
          <button type="button" class="ajuda-btn-nao" id="ajuda-nao">Não, outra coisa</button>
        </div>
      </div>

      <div id="ajuda-entrada">
        <input id="ajuda-input" type="text" maxlength="500" placeholder="Como posso te ajudar?" autocomplete="off" aria-label="Escreva o que você quer fazer"/>
        <button type="button" id="ajuda-enviar" aria-label="Enviar">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `)

  const $ = id => document.getElementById(id)
  const elWidget = $('ajuda-widget'), elBtn = $('ajuda-btn'), elPainel = $('ajuda-painel')
  const elFechar = $('ajuda-fechar'), elMsgs = $('ajuda-msgs'), elInput = $('ajuda-input'), elEnviar = $('ajuda-enviar')
  const elConfirma = $('ajuda-confirma'), elConfirmaTxt = $('ajuda-confirma-txt')
  const elSim = $('ajuda-sim'), elNao = $('ajuda-nao')
  const elSpot = $('ajuda-spot'), elTip = $('ajuda-tip'), elBarra = $('ajuda-barra')
  const elBarraPasso = $('ajuda-barra-passo'), elBarraDica = $('ajuda-barra-dica')
  const elVoltar = $('ajuda-voltar'), elAvancar = $('ajuda-avancar'), elCancelar = $('ajuda-cancelar')

  // ══════════════════════════════════════════════════════════════════════════
  // 7. ÍCONE ARRASTÁVEL
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A posição é guardada como PROPORÇÃO da tela (0 a 1), não em pixels. Assim,
  // se a janela mudar de tamanho, o ícone continua no mesmo "canto".

  function aplicarPosicao(x, y) {
    const margem = 8
    elWidget.style.left = limitar(x, margem, window.innerWidth  - TAMANHO_BOTAO - margem) + 'px'
    elWidget.style.top  = limitar(y, margem, window.innerHeight - TAMANHO_BOTAO - margem) + 'px'
  }

  function carregarPosicao() {
    try {
      const p = JSON.parse(localStorage.getItem(CHAVE_POSICAO) || 'null')
      if (p && typeof p.rx === 'number' && typeof p.ry === 'number') {
        aplicarPosicao(p.rx * (window.innerWidth - TAMANHO_BOTAO), p.ry * (window.innerHeight - TAMANHO_BOTAO))
        return
      }
    } catch (e) { /* sem posição salva: usa o padrão */ }
    // Padrão: canto inferior direito.
    aplicarPosicao(window.innerWidth - TAMANHO_BOTAO - 24, window.innerHeight - TAMANHO_BOTAO - 24)
  }

  function salvarPosicao() {
    const r = elWidget.getBoundingClientRect()
    const largura = window.innerWidth - TAMANHO_BOTAO
    const altura  = window.innerHeight - TAMANHO_BOTAO
    try {
      localStorage.setItem(CHAVE_POSICAO, JSON.stringify({
        rx: largura > 0 ? r.left / largura : 1,
        ry: altura  > 0 ? r.top  / altura  : 1
      }))
    } catch (e) { /* armazenamento indisponível: ignora */ }
  }

  // O painel abre para o lado onde há mais espaço (acima/abaixo, esquerda/direita
  // do ícone). Ancorar por "bottom"/"right" faz o painel crescer para o lado
  // certo quando chegam mensagens novas.
  function posicionarPainel() {
    const r = elBtn.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const acima = r.top + r.height / 2 > vh / 2
    const aDireita = r.left + r.width / 2 > vw / 2

    elPainel.style.top = elPainel.style.bottom = elPainel.style.left = elPainel.style.right = 'auto'

    if (acima) {
      elPainel.style.bottom = (vh - r.top + 12) + 'px'
      elPainel.style.maxHeight = Math.max(220, r.top - 24) + 'px'
    } else {
      elPainel.style.top = (r.bottom + 12) + 'px'
      elPainel.style.maxHeight = Math.max(220, vh - r.bottom - 24) + 'px'
    }

    if (aDireita) elPainel.style.right = Math.max(12, vw - r.right) + 'px'
    else          elPainel.style.left  = Math.max(12, r.left) + 'px'
  }

  let arrastando = false      // o botão está pressionado
  let moveu = false           // passou do limite de "só um clique"
  let ignorarClique = false   // o clique que vem depois de arrastar não abre o painel
  let inicioX = 0, inicioY = 0, desvioX = 0, desvioY = 0

  elBtn.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    arrastando = true
    moveu = false
    ignorarClique = false
    const r = elWidget.getBoundingClientRect()
    inicioX = e.clientX; inicioY = e.clientY
    desvioX = e.clientX - r.left; desvioY = e.clientY - r.top
    try { elBtn.setPointerCapture(e.pointerId) } catch (err) { /* ok */ }
  })

  elBtn.addEventListener('pointermove', e => {
    if (!arrastando) return
    // Só considera "arrasto" depois de 5px: evita mover sem querer ao clicar.
    if (!moveu && Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < 5) return
    moveu = true
    elBtn.classList.add('arrastando')
    aplicarPosicao(e.clientX - desvioX, e.clientY - desvioY)
    if (painelAberto) posicionarPainel()
  })

  function soltarBotao(e) {
    if (!arrastando) return
    arrastando = false
    elBtn.classList.remove('arrastando')
    try { elBtn.releasePointerCapture(e.pointerId) } catch (err) { /* ok */ }
    if (moveu) { salvarPosicao(); ignorarClique = true }
  }
  elBtn.addEventListener('pointerup', soltarBotao)
  elBtn.addEventListener('pointercancel', soltarBotao)

  // O "click" cobre mouse, toque e teclado (Enter/Espaço).
  elBtn.addEventListener('click', () => {
    if (ignorarClique) { ignorarClique = false; return }
    painelAberto ? fecharPainel() : abrirPainel()
  })

  window.addEventListener('resize', () => {
    carregarPosicao()
    if (painelAberto) posicionarPainel()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 8. PAINEL E MENSAGENS
  // ══════════════════════════════════════════════════════════════════════════

  let painelAberto = false
  let ocupado = false              // aguardando resposta da IA
  let guiaPendente = null          // guia aguardando o "Sim" da pessoa
  const historicoIA = []           // últimas falas, para a IA entender "e como excluo?"

  function abrirPainel(semSaudacao) {
    painelAberto = true
    posicionarPainel()
    elPainel.classList.replace('fechado', 'aberto')
    elBtn.setAttribute('aria-expanded', 'true')

    if (elMsgs.children.length === 0 && !semSaudacao) {
      addBot('Olá! 👋 Como posso te ajudar hoje?\n\nPosso te guiar em qualquer ação do sistema: basta me dizer o que você quer fazer.')
      mostrarSugestoes()
    }
    setTimeout(() => elInput.focus(), 150)
  }

  function fecharPainel() {
    painelAberto = false
    elPainel.classList.replace('aberto', 'fechado')
    elBtn.setAttribute('aria-expanded', 'false')
  }

  elFechar.addEventListener('click', fecharPainel)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && painelAberto) fecharPainel() })

  function rolarMensagens() { elMsgs.scrollTop = elMsgs.scrollHeight }

  // textContent (e não innerHTML): o texto que vem da IA ou do usuário nunca é
  // interpretado como HTML, o que bloqueia injeção de código na tela.
  function addBot(texto) {
    const el = document.createElement('div')
    el.className = 'ajuda-msg-bot'
    el.textContent = texto
    elMsgs.appendChild(el)
    rolarMensagens()
  }

  function addUsuario(texto) {
    const el = document.createElement('div')
    el.className = 'ajuda-msg-user'
    el.textContent = texto
    elMsgs.appendChild(el)
    rolarMensagens()
  }

  function addCarregando() {
    const el = document.createElement('div')
    el.className = 'ajuda-msg-loading'
    el.id = 'ajuda-carregando'
    el.innerHTML = '<div class="ajuda-pontos"><span></span><span></span><span></span></div>'
    elMsgs.appendChild(el)
    rolarMensagens()
  }

  function removerCarregando() {
    const el = $('ajuda-carregando')
    if (el) el.remove()
  }

  // Atalhos de exemplo na primeira abertura.
  function mostrarSugestoes() {
    const exemplos = ['Cadastrar um aluno', 'Criar um novo curso', 'Cadastrar uma turma', 'Emitir declaração de curso']
    const caixa = document.createElement('div')
    caixa.className = 'ajuda-sugestoes'
    exemplos.forEach(texto => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ajuda-chip'
      b.textContent = texto
      b.addEventListener('click', () => { caixa.remove(); enviar(texto) })
      caixa.appendChild(b)
    })
    elMsgs.appendChild(caixa)
    rolarMensagens()
  }

  function lembrar(papel, texto) {
    historicoIA.push({ papel, texto: String(texto).slice(0, 300) })
    while (historicoIA.length > 6) historicoIA.shift()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. COMUNICAÇÃO COM A IA (via backend)
  // ══════════════════════════════════════════════════════════════════════════

  // Catálogo enviado à IA a cada pergunta: o MAPA COMPLETO do sistema.
  //
  // A IA é quem PLANEJA o caminho. Para isso ela precisa conhecer todos os itens
  // de todas as telas (a ordem do que clicar e em qual tela fica). Para caber
  // na cota por minuto da Groq, o catálogo vai em formato COMPACTO (texto
  // curto por linha, sem JSON repetido): cerca de 4 mil tokens por pergunta
  // (o plano gratuito da Groq permite 6 mil por minuto no modelo reserva).
  //
  // Formato das linhas:
  //   elementos → "chave | o que é / o que faz"   (a chave diz a tela: alunos.*, cursos.*...)
  //   roteiros  → "chave | título"                (atalhos para tarefas padrão; a
  //                                                descrição completa só serve ao modo básico)
  const PREFIXO_DA_PAGINA = {
    'DASHBOARD.HTML': 'dash', 'ALUNOS.HTML': 'alunos', 'CURSOS.HTML': 'cursos', 'TURMAS.HTML': 'turmas',
    'DOCUMENTOS.HTML': 'docs', 'GRADE_HORARIA.HTML': 'grade', 'PROFESSORES.HTML': 'prof', 'USUARIOS.HTML': 'usuarios'
  }

  function catalogoParaIA() {
    return {
      paginas:   Object.keys(PAGINAS).map(p => p + ' (itens "' + PREFIXO_DA_PAGINA[p] + '.*"): ' + PAGINAS[p]),
      // "(janela do formulário de aluno)" vira "(janela aluno)": mesmo sentido, menos tokens.
      elementos: Object.keys(ELEMENTOS).map(chave =>
        chave + ' | ' + ELEMENTOS[chave].rotulo.replace(/\(janela (?:do formulário de |de |do )?/, '(janela ')),
      roteiros:  Object.keys(ROTEIROS).map(chave => chave + ' | ' + ROTEIROS[chave].titulo),
      limitacoes: LIMITACOES
    }
  }

  async function perguntarIA(mensagem) {
    // Timeout de 25s: se o servidor travar, a pessoa não fica esperando para sempre.
    const controle = new AbortController()
    const timer = setTimeout(() => controle.abort(), 25000)
    let resposta

    try {
      resposta = await fetch(API_URL + '/ajuda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({
          mensagem,
          pagina: paginaAtual(),
          historico: historicoIA.slice(0, -1) // sem a fala atual, que vai em "mensagem"
        }, catalogoParaIA())),
        signal: controle.signal
      })
    } catch (e) {
      const erro = new Error('rede')
      erro.codigo = 'rede'
      throw erro
    } finally {
      clearTimeout(timer)
    }

    let dados = null
    try { dados = await resposta.json() } catch (e) { /* corpo vazio ou inválido */ }

    if (!resposta.ok) {
      const erro = new Error((dados && dados.error) || 'Erro ' + resposta.status)
      // O servidor diz POR QUE falhou (config, chave, modelo, limite, grande, servidor).
      erro.codigo = (dados && dados.codigo) || (resposta.status === 429 ? 'limite' : 'servidor')
      throw erro
    }
    return dados
  }

  // Transforma o JSON da IA em algo seguro de usar. A IA pode errar o formato
  // ou inventar chaves: aqui tudo é conferido contra o catálogo real.
  function interpretar(json) {
    if (!json || typeof json !== 'object') {
      return { tipo: 'resposta', resposta: 'Não consegui interpretar. Pode reformular?' }
    }

    // "entendi" é a frase em que a própria IA resume o objetivo da pessoa.
    const entendi = String(json.entendi || '').trim().slice(0, 120)

    // 1) PLANO PRÓPRIO da IA: o caminho montado sob medida para o pedido.
    //    Só passam passos cujas chaves existem no catálogo real.
    if (Array.isArray(json.passos) && json.passos.length) {
      const passos = json.passos
        .filter(p => p && typeof p.el === 'string' && ELEMENTOS[p.el])
        .slice(0, 15)
        .map(p => ({ el: p.el, texto: String(p.texto || ELEMENTOS[p.el].rotulo).slice(0, 220) }))

      if (passos.length) {
        return {
          tipo: 'guia', titulo: entendi || 'Guia personalizado', passos, aviso: '',
          confirmacao: String(json.confirmacao || ('Você quer ' + (entendi || 'fazer isso') + '. Posso te guiar passo a passo?')).slice(0, 300)
        }
      }
    }

    // 2) A IA indicou um roteiro pronto (tarefa padrão e exata).
    if (typeof json.roteiro === 'string' && ROTEIROS[json.roteiro]) {
      return guiaDeRoteiro(json.roteiro, json.confirmacao)
    }

    // 3) Disse "guia", mas nada do que veio existe no sistema. Em vez de forçar
    //    um fluxo parecido (erro clássico), admite e pede para reformular.
    if (json.tipo === 'guia') {
      return { tipo: 'resposta', resposta: 'Entendi o que você quer, mas não consegui montar o caminho na tela. Pode me explicar de outro jeito?' }
    }

    // 4) Resposta em texto.
    const texto = json.resposta || json.confirmacao
    return { tipo: 'resposta', resposta: String(texto || 'Não entendi bem. Pode reformular?').slice(0, 1200) }
  }

  function guiaDeRoteiro(chave, confirmacao) {
    const r = ROTEIROS[chave]
    return {
      tipo: 'guia',
      titulo: r.titulo,
      aviso: r.aviso || '',
      passos: r.passos.map(([el, texto, avancar]) => ({ el, texto, avancar })),
      confirmacao: String(confirmacao || ('Você quer ' + r.titulo.toLowerCase() + '. Posso te guiar passo a passo?')).slice(0, 300)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. ENVIO DA MENSAGEM
  // ══════════════════════════════════════════════════════════════════════════

  async function enviar(texto) {
    const mensagem = String(texto || '').trim().slice(0, 500)
    if (!mensagem || ocupado) return

    ocupado = true
    elInput.value = ''
    elInput.disabled = true
    elEnviar.disabled = true
    elConfirma.style.display = 'none'
    guiaPendente = null

    addUsuario(mensagem)
    lembrar('user', mensagem)
    addCarregando()

    let resultado
    try {
      resultado = interpretar(await perguntarIA(mensagem))
    } catch (erro) {
      resultado = alternativaSemIA(mensagem, erro)
    }

    removerCarregando()
    mostrarResultado(resultado)

    ocupado = false
    elInput.disabled = false
    elEnviar.disabled = false
    elInput.focus()
  }

  // A IA falhou. NUNCA escondemos isso: a pessoa é avisada do motivo e, se o
  // modo básico reconhecer o pedido, é avisada de que ele é menos preciso.
  function alternativaSemIA(mensagem, erro) {
    const curto = {
      config:   'a chave GROQ_API_KEY não está configurada no .env do servidor',
      chave:    'a Groq recusou a chave GROQ_API_KEY; gere uma nova e atualize o .env',
      modelo:   'o modelo de IA configurado não existe mais na Groq; abra ' + API_URL + '/ajuda/diagnostico para ver os modelos disponíveis',
      grande:   'o pedido passou do limite por minuto da Groq; aguarde cerca de um minuto',
      rede:     'não consegui falar com o servidor em ' + API_URL + ' (o backend está rodando?)',
      limite:   'o limite de uso da IA foi atingido; aguarde alguns segundos',
      servidor: 'a IA não respondeu agora; veja o terminal do backend, que mostra o motivo'
    }
    const motivo = curto[erro && erro.codigo] || curto.servidor

    const local = identificarLocal(mensagem)
    if (local) {
      const guia = guiaDeRoteiro(local)
      guia.avisoIA = '⚠️ Não consegui usar a IA (' + motivo + '). Usei o modo básico, que é bem menos preciso. Se não for isso que você quer, toque em "Não, outra coisa".'
      return guia
    }

    return { tipo: 'resposta', resposta: '⚠️ Não consegui usar a IA (' + motivo + ') e o modo básico não reconheceu esse pedido.' }
  }

  function mostrarResultado(r) {
    if (r.avisoIA) addBot(r.avisoIA)

    if (r.tipo === 'guia') {
      guiaPendente = r
      elConfirmaTxt.textContent = r.confirmacao
      elConfirma.style.display = 'flex'
      lembrar('assistant', r.confirmacao)
      rolarMensagens()
      return
    }
    addBot(r.resposta)
    lembrar('assistant', r.resposta)
  }

  elEnviar.addEventListener('click', () => enviar(elInput.value))
  elInput.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(elInput.value) })

  elNao.addEventListener('click', () => {
    elConfirma.style.display = 'none'
    guiaPendente = null
    addBot('Tudo bem! Me conta o que você precisa fazer. 😊')
    elInput.focus()
  })

  elSim.addEventListener('click', () => {
    if (!guiaPendente) return
    const g = guiaPendente
    guiaPendente = null
    elConfirma.style.display = 'none'

    if (g.aviso) addBot(g.aviso)
    addBot('Perfeito! Vou destacar na tela onde clicar. Siga os destaques em azul. ✨')

    // Pequena pausa para a pessoa ler antes do painel fechar.
    setTimeout(() => {
      fecharPainel()
      iniciarGuia(g.titulo, g.passos)
    }, 500)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 11. MOTOR DO GUIA
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Estado do guia: { titulo, passos: [{el, texto, avancar}], idx, navegacoes }
  // Fica também no sessionStorage para sobreviver à troca de página.

  let guia = null
  let alvoAtual = null     // elemento destacado agora
  let limpezas = []        // funções que removem os ouvintes do passo atual
  let tokenPasso = 0       // invalida esperas antigas quando o passo muda
  let rafId = 0

  function salvarEstado(esperando) {
    if (!guia) return
    try {
      sessionStorage.setItem(CHAVE_ESTADO, JSON.stringify({
        titulo: guia.titulo, passos: guia.passos, idx: guia.idx,
        navegacoes: guia.navegacoes || 0,
        // "esperando" = nós mesmos vamos trocar de página. Se a pessoa navegar
        // por conta própria no meio do guia, não retomamos (seria invasivo).
        esperando: !!esperando
      }))
    } catch (e) { /* sem sessionStorage: o guia só não sobrevive à navegação */ }
  }

  function limparEstado() {
    try { sessionStorage.removeItem(CHAVE_ESTADO) } catch (e) { /* ok */ }
  }

  function iniciarGuia(titulo, passos) {
    // completarPassos acrescenta o caminho pelo menu e a abertura de janelas.
    guia = { titulo, passos: completarPassos(passos), idx: 0, navegacoes: 0 }
    document.body.classList.add('ajuda-em-guia')
    irParaPasso(0)
  }

  function atualizarBarra() {
    if (!guia) return
    elBarraPasso.textContent = 'Passo ' + (guia.idx + 1) + ' de ' + guia.passos.length
    elVoltar.disabled = guia.idx === 0
  }

  // Remove destaque e ouvintes do passo atual e invalida esperas pendentes.
  function limparPasso() {
    tokenPasso++
    limpezas.forEach(fn => { try { fn() } catch (e) { /* ok */ } })
    limpezas = []
    cancelAnimationFrame(rafId)
    alvoAtual = null
    elSpot.style.display = 'none'
    elTip.style.display = 'none'
  }

  // "sentido" é 1 ao avançar e -1 ao voltar (usado para pular passos de
  // navegação que não fazem sentido quando já estamos na tela de destino).
  function irParaPasso(idx, sentido = 1) {
    limparPasso()
    if (!guia) return

    if (idx >= guia.passos.length) { encerrarGuia(true); return }
    if (idx < 0) idx = 0

    guia.idx = idx
    salvarEstado(false)
    atualizarBarra()

    const passo = guia.passos[idx]
    const def = ELEMENTOS[passo.el]
    if (!def) { irParaPasso(idx + 1); return }   // chave desconhecida: pula

    // Passo de "ir até a tela X" e já estamos nela (ex.: depois de Voltar):
    // não faz sentido mostrar o menu de novo, pula para o vizinho.
    if (passo.nav && passo.nav === paginaAtual()) {
      irParaPasso(idx + sentido < 0 ? idx + 1 : idx + sentido, idx + sentido < 0 ? 1 : sentido)
      return
    }

    // REDE DE SEGURANÇA: o passo é de outra página e o planejador não inseriu o
    // caminho pelo menu (não deveria acontecer). Só então navegamos direto.
    if (def.pagina !== '*' && def.pagina !== paginaAtual()) {
      navegarPara(def.pagina)
      return
    }

    const meuToken = tokenPasso
    elBarraDica.textContent = 'Procurando na tela…'

    esperarElemento(def).then(el => {
      if (meuToken !== tokenPasso || !guia) return   // o passo mudou enquanto esperava
      if (el) prepararAlvo(el, passo, def)
      else    mostrarSemElemento(passo)
    })
  }

  function navegarPara(pagina) {
    guia.navegacoes = (guia.navegacoes || 0) + 1

    // Sem progresso depois de várias trocas de página? Algo está errado: para.
    if (guia.navegacoes > MAX_NAVEGACOES) {
      encerrarGuia(false)
      abrirPainel(true)
      addBot('Não consegui chegar à tela certa. Tente abrir a página pelo menu e peça de novo.')
      return
    }

    salvarEstado(true)
    // Mantém a pasta atual e troca só o nome do arquivo (ignora ?query e #hash).
    location.href = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + pagina
  }

  function prepararAlvo(el, passo, def) {
    guia.navegacoes = 0   // chegou a um elemento: houve progresso

    // No celular o menu lateral fica escondido: primeiro mostramos o botão que
    // o abre e, depois do clique, repetimos este mesmo passo.
    if (el.closest('#sidebar') && menuFechado()) {
      const botaoMenu = document.getElementById('menuBtn')
      if (botaoMenu && renderizavel(botaoMenu)) {
        const idxAtual = guia.idx
        ativarAlvo(botaoMenu, 'Abra o menu lateral para continuar.', 'click', () => {
          setTimeout(() => { if (guia && guia.idx === idxAtual) irParaPasso(idxAtual) }, 400)
        })
        return
      }
    }

    const modo = passo.avancar || def.avancar || avancarPadrao(el)
    const dica = passo.nav ? 'Primeiro, clique no item destacado do menu para ir até a tela' : ''
    ativarAlvo(el, passo.texto, modo, () => proximo(el), dica)
  }

  // Destaca o elemento, mostra a instrução e fica ouvindo o fim do passo.
  function ativarAlvo(el, texto, modo, aoConcluir, dicaExtra) {
    alvoAtual = el
    elTip.textContent = texto
    elTip.classList.remove('centro')

    const dicas = {
      click:  'Clique no elemento destacado',
      change: 'Preencha o campo destacado (ou use Avançar)',
      manual: 'Leia e clique em Avançar'
    }
    elBarraDica.textContent = dicaExtra || dicas[modo] || dicas.manual

    if (modo === 'click' || modo === 'change') {
      // No clique usamos a fase de captura: assim o ouvinte roda mesmo se a
      // página interromper a propagação do evento.
      const captura = modo === 'click'
      const ouvinte = () => aoConcluir()
      el.addEventListener(modo, ouvinte, captura)
      limpezas.push(() => el.removeEventListener(modo, ouvinte, captura))
    }

    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) { /* ok */ }
    iniciarLoopDeDestaque()
  }

  // Passo cujo elemento não está na tela (tabela vazia, janela fechada...).
  // Mostra a instrução no centro e deixa a pessoa decidir.
  function mostrarSemElemento(passo) {
    alvoAtual = null
    elSpot.style.display = 'none'
    elTip.textContent = passo.texto
    elTip.className = 'centro'
    elTip.style.display = 'block'
    elTip.style.left = '50%'
    elTip.style.top = '80px'
    elTip.style.transform = 'translateX(-50%)'
    elBarraDica.textContent = 'Não achei esse item na tela agora. Siga a instrução e clique em Avançar'
  }

  // Fim do passo atual: vai para o próximo.
  function proximo(elOrigem) {
    if (!guia) return
    const prox = guia.idx + 1
    guia.idx = prox

    // O clique foi num link que troca de página sozinho: só registramos o
    // próximo passo para retomar lá (nunca navegar por cima do link, senão
    // perderíamos parâmetros como ?curso=3).
    if (elOrigem && ehLinkDeNavegacao(elOrigem)) {
      limparPasso()
      salvarEstado(true)
      return
    }

    salvarEstado(false)
    limparPasso()
    // Pequena pausa: dá tempo da própria tela reagir ao clique (abrir modal etc.).
    setTimeout(() => { if (guia && guia.idx === prox) irParaPasso(prox) }, 350)
  }

  // Mantém destaque e balão colados no elemento, mesmo com rolagem,
  // animação de modal ou redimensionamento.
  function iniciarLoopDeDestaque() {
    cancelAnimationFrame(rafId)
    const quadro = () => {
      if (!guia || !alvoAtual) return

      // O elemento foi recriado pela tela (ex.: tabela re-renderizada):
      // procura de novo o mesmo passo.
      if (!alvoAtual.isConnected) {
        const idx = guia.idx
        alvoAtual = null
        irParaPasso(idx)
        return
      }
      posicionarDestaque(alvoAtual)
      rafId = requestAnimationFrame(quadro)
    }
    rafId = requestAnimationFrame(quadro)
  }

  function posicionarDestaque(el) {
    const r = el.getBoundingClientRect()

    // Elemento escondido no momento (ex.: janela fechada): some o destaque.
    if (!renderizavel(el) || (r.width === 0 && r.height === 0)) {
      elSpot.style.display = 'none'
      elTip.style.display = 'none'
      return
    }

    const folga = 6
    elSpot.style.display = 'block'
    elSpot.style.left   = (r.left - folga) + 'px'
    elSpot.style.top    = (r.top - folga) + 'px'
    elSpot.style.width  = (r.width + folga * 2) + 'px'
    elSpot.style.height = (r.height + folga * 2) + 'px'

    // Balão: abaixo do elemento se couber; senão acima; senão sobre ele.
    elTip.style.display = 'block'
    elTip.style.transform = ''
    const w = elTip.offsetWidth, h = elTip.offsetHeight
    const vw = window.innerWidth, vh = window.innerHeight
    const espacoAbaixo = vh - r.bottom - folga
    const espacoAcima  = r.top - folga

    let topo, lado = ''
    if (espacoAbaixo >= h + 20)      { topo = r.bottom + folga + 12; lado = 'baixo' }
    else if (espacoAcima >= h + 20)  { topo = r.top - folga - 12 - h; lado = 'cima' }
    else                             { topo = limitar(r.top + 12, 12, vh - h - 12) }

    const esquerda = limitar(r.left, 10, Math.max(10, vw - w - 10))
    elTip.className = lado
    elTip.style.top = topo + 'px'
    elTip.style.left = esquerda + 'px'
    // A seta do balão aponta para o centro do elemento.
    elTip.style.setProperty('--seta', limitar(r.left + r.width / 2 - esquerda - 7, 14, Math.max(14, w - 28)) + 'px')

    // A barra de progresso vai para o topo se o elemento estiver embaixo,
    // para nunca cobrir o que a pessoa precisa clicar.
    elBarra.classList.toggle('topo', r.bottom > vh - 110)
  }

  function encerrarGuia(concluido) {
    limparPasso()
    document.body.classList.remove('ajuda-em-guia')
    elBarra.classList.remove('topo')
    guia = null
    limparEstado()
    carregarPosicao()   // o ícone volta a aparecer; garante que está dentro da tela

    if (concluido) {
      setTimeout(() => {
        abrirPainel(true)
        addBot('Pronto! 🎉 Conseguiu concluir?\n\nSe precisar de mais ajuda, é só me chamar.')
      }, 300)
    }
  }

  elAvancar.addEventListener('click', () => proximo(null))
  elVoltar.addEventListener('click', () => { if (guia) irParaPasso(guia.idx - 1, -1) })
  elCancelar.addEventListener('click', () => encerrarGuia(false))

  // ══════════════════════════════════════════════════════════════════════════
  // 12. RETOMAR O GUIA APÓS TROCA DE PÁGINA
  // ══════════════════════════════════════════════════════════════════════════

  function retomarGuia() {
    let estado = null
    try { estado = JSON.parse(sessionStorage.getItem(CHAVE_ESTADO) || 'null') } catch (e) { /* ok */ }
    if (!estado || !Array.isArray(estado.passos)) return

    // A pessoa saiu da página por conta própria: abandona o guia.
    if (!estado.esperando) { limparEstado(); return }

    // Estado antigo/corrompido com chaves que não existem mais: descarta.
    if (!estado.passos.every(p => p && ELEMENTOS[p.el])) { limparEstado(); return }

    guia = { titulo: estado.titulo, passos: estado.passos, idx: estado.idx || 0, navegacoes: estado.navegacoes || 0 }
    document.body.classList.add('ajuda-em-guia')

    // Espera um instante: as telas do SICEP carregam seus dados via fetch
    // logo ao abrir, e o guia precisa encontrar a tabela/lista já pronta.
    setTimeout(() => { if (guia) irParaPasso(guia.idx) }, 500)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. INICIALIZAÇÃO
  // ══════════════════════════════════════════════════════════════════════════

  carregarPosicao()
  retomarGuia()

})()
