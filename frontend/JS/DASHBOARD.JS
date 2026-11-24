(() => {
  const API = 'http://localhost:3000';

  // Cores: uma por medida (turmas = azul) e uma por ano (ano atual = laranja, ano anterior = cinza)
  const COR_TURMAS = '#07224f';
  const COR_ANO_ATUAL = '#eb6834';
  const COR_ANO_ANTERIOR = '#8a8984';
  const COR_GRADE = '#e5e5e3';
  const COR_BASE = '#cfcfcb';
  const COR_TEXTO = '#6b6b68';
  const COR_TEXTO_FORTE = '#1a1a19';

  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const el = id => document.getElementById(id);
  const mensagem = el('dashboardMsg');
  const tooltip = el('graficoTooltip');
  const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;

  function criar(tag, classe = '', texto = '', estilo = {}) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto) no.textContent = texto;
    Object.assign(no.style, estilo);
    return no;
  }

  function svg(tag, atributos = {}, texto = '') {
    const no = document.createElementNS(SVG_NS, tag);
    Object.entries(atributos).forEach(([nome, valor]) => no.setAttribute(nome, valor));
    if (texto) no.textContent = texto;
    return no;
  }

  // ---------- Tooltip (mouse e teclado) ----------
  function mostrarDica(texto, x, y) {
    tooltip.textContent = texto;
    tooltip.classList.remove('hidden');
    const largura = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - largura - 8))}px`;
    tooltip.style.top = `${Math.max(8, y - 36)}px`;
  }

  function esconderDica() {
    tooltip.classList.add('hidden');
  }

  function ligarDica(alvo, texto, aoEntrar = () => {}, aoSair = () => {}) {
    alvo.setAttribute('tabindex', '0');
    alvo.setAttribute('role', 'listitem');
    alvo.setAttribute('aria-label', texto.replace(/\n/g, '. '));
    const entrar = e => { aoEntrar(); mostrarDica(texto, e.clientX, e.clientY); };
    const sair = () => { aoSair(); esconderDica(); };
    alvo.addEventListener('mouseenter', entrar);
    alvo.addEventListener('mousemove', e => mostrarDica(texto, e.clientX, e.clientY));
    alvo.addEventListener('mouseleave', sair);
    alvo.addEventListener('focus', () => {
      aoEntrar();
      const caixa = alvo.getBoundingClientRect();
      mostrarDica(texto, caixa.left + caixa.width / 2, caixa.top);
    });
    alvo.addEventListener('blur', sair);
  }

  // ---------- Gráfico 1: turmas por curso (barras horizontais) ----------
  // O nome do curso fica em cima da barra, por extenso, para nunca ser cortado.
  function desenharCursos(lista) {
    const area = el('graficoCursos');
    const resumo = el('graficoCursosResumo');
    area.replaceChildren();

    if (!lista.length) {
      resumo.textContent = 'Nenhum curso cadastrado ainda.';
      return;
    }

    const maximo = Math.max(...lista.map(item => item.total));
    const lideres = lista.filter(item => item.total === maximo);

    if (maximo === 0) {
      resumo.textContent = 'Nenhuma turma cadastrada ainda.';
    } else if (lideres.length === 1) {
      resumo.textContent = `${lideres[0].curso} tem mais turmas: ${plural(maximo, 'turma', 'turmas')}.`;
    } else {
      resumo.textContent = `${lideres.length} cursos empatados com ${plural(maximo, 'turma', 'turmas')} cada.`;
    }

    area.setAttribute('role', 'list');
    area.setAttribute('aria-label', 'Turmas cadastradas por curso');

    lista.forEach(item => {
      const bloco = criar('div', 'rounded-md hover:bg-gray-50 focus:bg-gray-50 outline-none', '', { padding: '6px 8px', marginBottom: '2px' });

      const nome = criar('div', 'text-sm text-gray-700', item.curso, { overflowWrap: 'anywhere', lineHeight: '18px', marginBottom: '4px' });

      const trilho = criar('div', 'flex items-center gap-2');
      const largura = maximo > 0 ? (item.total / maximo) * 92 : 0;
      const barra = criar('div', '', '', {
        width: `${largura}%`,
        minWidth: item.total > 0 ? '4px' : '0',
        height: '18px',
        background: COR_TURMAS,
        borderRadius: '0 4px 4px 0'
      });
      const valor = criar('span', 'text-sm font-medium text-gray-900', String(item.total));
      valor.style.fontVariantNumeric = 'tabular-nums';

      trilho.append(barra, valor);
      bloco.append(nome, trilho);
      ligarDica(bloco, `${item.curso}: ${plural(item.total, 'turma', 'turmas')}`);
      area.append(bloco);
    });
  }

  // ---------- Escala do eixo Y: números inteiros e redondos ----------
  function escala(maximo) {
    const alvo = Math.max(maximo, 1);
    let passo = 1;
    for (let potencia = 1; ; potencia *= 10) {
      const candidato = [1, 2, 5].map(base => base * potencia).find(p => Math.ceil(alvo / p) <= 4);
      if (candidato) { passo = candidato; break; }
    }
    const topo = Math.ceil(alvo / passo) * passo;
    const marcas = [];
    for (let v = 0; v <= topo; v += passo) marcas.push(v);
    return { topo, marcas };
  }

  // ---------- Gráfico 2: linhas, ano anterior x ano atual ----------
  let ultimosDadosAlunos = null;

  function desenharAlunos(dados) {
    ultimosDadosAlunos = dados;
    const area = el('graficoAlunos');
    const resumo = el('graficoAlunosResumo');
    area.replaceChildren();

    if (!dados || !dados.meses || !dados.meses.length) {
      resumo.textContent = 'Nenhum aluno cadastrado ainda.';
      return;
    }

    const { ano_atual: anoAtual, ano_anterior: anoAnterior, meses } = dados;
    const soma = chave => meses.reduce((total, mes) => total + (mes[chave] || 0), 0);
    resumo.textContent = `${anoAtual}: ${plural(soma('atual'), 'cadastro', 'cadastros')} · ${anoAnterior}: ${plural(soma('anterior'), 'cadastro', 'cadastros')}.`;

    const series = [
      { chave: 'anterior', ano: anoAnterior, cor: COR_ANO_ANTERIOR },
      { chave: 'atual', ano: anoAtual, cor: COR_ANO_ATUAL }
    ];

    // Legenda (sempre visível quando há 2 séries)
    const legenda = criar('div', 'flex flex-wrap items-center gap-5 text-sm text-gray-700');
    series.forEach(serie => {
      const item = criar('span', 'inline-flex items-center gap-2');
      item.append(criar('span', '', '', { display: 'inline-block', width: '16px', height: '3px', borderRadius: '2px', background: serie.cor }), criar('span', '', String(serie.ano)));
      legenda.append(item);
    });

    // O gráfico ocupa toda a altura que sobra no cartão (a mesma altura do gráfico de barras ao lado)
    const interno = criar('div', '', '', { position: 'absolute', top: '0', right: '0', bottom: '0', left: '0', display: 'flex', flexDirection: 'column' });
    const caixa = criar('div', '', '', { position: 'relative', flex: '1 1 auto', minHeight: '0' });
    interno.append(legenda, criar('div', '', '', { height: '8px', flex: '0 0 auto' }), caixa);
    area.append(interno);

    // Medidas do gráfico
    const largura = Math.max(300, caixa.clientWidth || 560);
    const altura = Math.max(200, caixa.clientHeight || 240);
    const margem = { esquerda: 34, direita: 14, topo: 26, base: 30 };
    const larguraUtil = largura - margem.esquerda - margem.direita;
    const alturaUtil = altura - margem.topo - margem.base;

    const valores = meses.flatMap(mes => [mes.atual, mes.anterior]).filter(v => v !== null && v !== undefined);
    const { topo, marcas } = escala(Math.max(...valores, 0));

    const x = indice => margem.esquerda + (indice + 0.5) * (larguraUtil / 12);
    const y = valor => margem.topo + alturaUtil - (valor / topo) * alturaUtil;

    const grafico = svg('svg', { width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`, role: 'group', 'aria-label': `Alunos cadastrados por mês em ${anoAnterior} e ${anoAtual}` });
    grafico.style.display = 'block';

    // Grade e eixo Y
    marcas.forEach(valor => {
      grafico.append(svg('line', { x1: margem.esquerda, x2: largura - margem.direita, y1: y(valor), y2: y(valor), stroke: valor === 0 ? COR_BASE : COR_GRADE, 'stroke-width': 1 }));
      grafico.append(svg('text', { x: margem.esquerda - 8, y: y(valor), 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 12, fill: COR_TEXTO }, String(valor)));
    });

    // Meses no eixo X
    MESES_CURTOS.forEach((nome, indice) => {
      grafico.append(svg('text', { x: x(indice), y: altura - 10, 'text-anchor': 'middle', 'font-size': 11, fill: COR_TEXTO }, nome));
    });

    // Linha vertical que acompanha o mês sob o mouse
    const guia = svg('line', { y1: margem.topo, y2: margem.topo + alturaUtil, stroke: COR_BASE, 'stroke-width': 1, visibility: 'hidden' });
    grafico.append(guia);

    // Linhas e marcadores
    series.forEach(serie => {
      let trecho = [];
      const trechos = [trecho];
      meses.forEach((mes, indice) => {
        const valor = mes[serie.chave];
        if (valor === null || valor === undefined) {
          if (trecho.length) { trecho = []; trechos.push(trecho); }
          return;
        }
        trecho.push([x(indice), y(valor)]);
      });

      trechos.filter(pontos => pontos.length > 1).forEach(pontos => {
        grafico.append(svg('path', {
          d: pontos.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' '),
          fill: 'none', stroke: serie.cor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        }));
      });

      meses.forEach((mes, indice) => {
        const valor = mes[serie.chave];
        if (valor === null || valor === undefined) return;
        grafico.append(svg('circle', { cx: x(indice), cy: y(valor), r: 4, fill: serie.cor, stroke: '#ffffff', 'stroke-width': 2 }));
      });
    });

    // Número só no último mês do ano atual (o resto fica na dica ao passar o mouse)
    let ultimoIndice = -1;
    meses.forEach((mes, indice) => { if (mes.atual !== null && mes.atual !== undefined) ultimoIndice = indice; });
    if (ultimoIndice >= 0) {
      grafico.append(svg('text', {
        x: x(ultimoIndice), y: y(meses[ultimoIndice].atual) - 11, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: COR_TEXTO_FORTE
      }, String(meses[ultimoIndice].atual)));
    }

    // Áreas de passar o mouse: uma faixa por mês, mais larga que os pontos
    const lista = svg('g', { role: 'list', 'aria-label': 'Cadastros por mês' });
    meses.forEach((mes, indice) => {
      const faixa = svg('rect', { x: margem.esquerda + indice * (larguraUtil / 12), y: margem.topo, width: larguraUtil / 12, height: alturaUtil, fill: 'transparent' });
      faixa.style.outline = 'none';
      const linhaAtual = `${anoAtual}: ${mes.atual === null || mes.atual === undefined ? 'ainda sem dados' : plural(mes.atual, 'aluno', 'alunos')}`;
      const linhaAnterior = `${anoAnterior}: ${plural(mes.anterior || 0, 'aluno', 'alunos')}`;
      ligarDica(
        faixa,
        `${MESES_LONGOS[indice]}\n${linhaAtual}\n${linhaAnterior}`,
        () => { guia.setAttribute('x1', x(indice)); guia.setAttribute('x2', x(indice)); guia.setAttribute('visibility', 'visible'); },
        () => guia.setAttribute('visibility', 'hidden')
      );
      lista.append(faixa);
    });
    grafico.append(lista);

    caixa.append(grafico);
  }

  // ---------- Tabela: curso, turmas, alunos e comparativo entre os dois anos ----------
  function variacao(anterior, atual) {
    if (!anterior && !atual) return { tipo: 'vazio', rotulo: 'Sem cadastros', icone: '', cor: '#6b6b68', fundo: '#ececea', detalhe: '' };
    const diferenca = atual - anterior;
    const percentual = anterior > 0 ? Math.round((diferenca / anterior) * 100) : null;
    const textoPercentual = percentual === null ? '' : ` (${percentual > 0 ? '+' : ''}${percentual}%)`;
    if (diferenca > 0) return { tipo: 'aumento', rotulo: 'Aumento', icone: '\u25B2', cor: '#166534', fundo: '#dcf2e3', detalhe: `+${diferenca}${textoPercentual}` };
    if (diferenca < 0) return { tipo: 'queda', rotulo: 'Queda', icone: '\u25BC', cor: '#991b1b', fundo: '#fde3e3', detalhe: `\u2212${Math.abs(diferenca)}${textoPercentual}` };
    return { tipo: 'estavel', rotulo: 'Sem variação', icone: '=', cor: '#52514e', fundo: '#ececea', detalhe: '0' };
  }

  function celulaComparativo(celula, anterior, atual, anos) {
    celula.replaceChildren();
    if (!anos.anterior || !anos.atual) {
      celula.textContent = '\u2014';
      return;
    }
    const v = variacao(anterior, atual);
    const caixa = criar('div', 'flex flex-wrap items-center justify-center gap-2');
    const selo = criar('span', 'inline-flex items-center gap-1 rounded-full text-xs font-semibold', '', { padding: '2px 10px', background: v.fundo, color: v.cor });
    selo.append(...(v.icone ? [criar('span', '', v.icone, { fontSize: '10px' })] : []), criar('span', '', v.rotulo));
    caixa.append(selo);
    if (v.detalhe) caixa.append(criar('span', 'text-xs', v.detalhe, { color: v.cor, fontVariantNumeric: 'tabular-nums' }));
    celula.append(caixa);
    celula.title = `${anos.anterior}: ${plural(anterior, 'aluno', 'alunos')} \u00B7 ${anos.atual}: ${plural(atual, 'aluno', 'alunos')}`;
  }

  function desenharTabelaCursos(tabela) {
    const corpo = el('tabelaCursos');
    corpo.replaceChildren();

    const linhas = (tabela && tabela.linhas) || [];
    const anos = { anterior: tabela && tabela.ano_anterior, atual: tabela && tabela.ano_atual };
    const temAnos = Boolean(anos.anterior && anos.atual);

    el('tituloComparativo').textContent = temAnos ? `${anos.anterior} vs ${anos.atual}` : 'Comparativo';
    el('tabelaCursosResumo').textContent = temAnos
      ? `Turmas cadastradas, alunos ativos por curso e comparação de ${anos.anterior} para ${anos.atual}.`
      : 'Turmas cadastradas e alunos ativos por curso.';
    el('notaCursos').textContent = temAnos
      ? `Alunos: alunos ativos com matrícula ativa em turmas do curso. A linha "Sem matrícula ativa" reúne os alunos ativos que ainda não estão em nenhuma turma, por isso o total é igual ao card Alunos ativos. ${anos.anterior} vs ${anos.atual}: desses alunos, quantos foram cadastrados em cada ano. Quem está em mais de um curso aparece em cada um deles; o total conta cada aluno uma vez.`
      : 'Alunos: alunos ativos com matrícula ativa em turmas do curso. A linha "Sem matrícula ativa" reúne os alunos ativos que ainda não estão em nenhuma turma.';

    if (!linhas.length) {
      const tr = criar('tr');
      const td = criar('td', 'px-5 py-6 text-center text-gray-500', 'Nenhum curso cadastrado ainda.');
      td.colSpan = 4;
      tr.append(td);
      corpo.append(tr);
      el('totalTurmas').textContent = '0';
      el('totalAlunos').textContent = '0';
      el('totalComparativo').replaceChildren();
      return;
    }

    linhas.forEach((linha, indice) => {
      const tr = criar('tr', '', '', { background: indice % 2 === 0 ? '#f3f4f6' : '#ffffff' });
      const comparativo = criar('td', 'px-5 py-3 text-center');
      celulaComparativo(comparativo, linha.alunos_ano_anterior, linha.alunos_ano_atual, anos);
      const semCurso = Boolean(linha.sem_curso);
      tr.append(
        criar('td', semCurso ? 'px-5 py-3 text-gray-600 italic' : 'px-5 py-3 font-medium text-gray-900', linha.curso, { overflowWrap: 'anywhere' }),
        criar('td', 'px-5 py-3 text-center text-gray-800', semCurso || linha.turmas === null ? '\u2014' : String(linha.turmas), { fontVariantNumeric: 'tabular-nums' }),
        criar('td', 'px-5 py-3 text-center text-gray-800', String(linha.alunos), { fontVariantNumeric: 'tabular-nums' }),
        comparativo
      );
      corpo.append(tr);
    });

    const totais = tabela.totais || { turmas: 0, alunos: 0, alunos_ano_anterior: 0, alunos_ano_atual: 0 };
    el('totalTurmas').textContent = String(totais.turmas);
    el('totalAlunos').textContent = String(totais.alunos);
    celulaComparativo(el('totalComparativo'), totais.alunos_ano_anterior, totais.alunos_ano_atual, anos);
  }

  // ---------- Carregar tudo ----------
  async function carregar() {
    try {
      const resposta = await fetch(`${API}/dashboard/resumo`);
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Erro ao consultar /dashboard/resumo');

      el('kpiAlunos').textContent = dados.alunos_ativos;
      el('kpiAlunosDetalhe').textContent = `${dados.alunos_com_matricula_ativa} com matrícula ativa em turmas`;
      el('kpiTurmas').textContent = dados.turmas_ativas;
      el('kpiProfessores').textContent = dados.professores_ativos;
      el('kpiOcupacao').textContent = `${dados.taxa_ocupacao}%`;
      el('kpiOcupacaoDetalhe').textContent = `${dados.vagas_preenchidas} de ${dados.vagas_totais} vagas preenchidas`;

      desenharCursos(dados.turmas_por_curso || []);
      desenharAlunos(dados.alunos_por_ano_mes);
      desenharTabelaCursos(dados.tabela_cursos);

      mensagem.textContent = '';
      mensagem.className = 'mt-6 text-sm text-gray-500';
    } catch (falha) {
      console.error('Dashboard:', falha);
      el('graficoCursosResumo').textContent = 'Não foi possível carregar o gráfico.';
      el('graficoAlunosResumo').textContent = 'Não foi possível carregar o gráfico.';
      mensagem.textContent = `Não foi possível carregar os indicadores (${falha.message}). Verifique se o servidor está rodando em ${API}.`;
      mensagem.className = 'mt-6 text-sm text-red-600';
    }
  }

  // Redesenha o gráfico de linhas se a janela mudar de tamanho
  let temporizador = null;
  window.addEventListener('resize', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ultimosDadosAlunos && desenharAlunos(ultimosDadosAlunos), 150);
  });

  carregar();
})();
