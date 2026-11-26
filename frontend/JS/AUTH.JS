
(() => {

  // ========================================
  // CONFIGURAÇÕES
  // ========================================

  const API = String(
    window.SICEP_API_URL || 'http://localhost:3000'
  ).replace(/\/+$/, '');

  const CHAVE_TOKEN = 'sicep.token';
  const CHAVE_USUARIO = 'sicep.usuario';

  const URL_LOGIN = new URL(
    '../index.html',
    document.currentScript.src
  ).href;

  const guardas = [
    window.localStorage,
    window.sessionStorage
  ];

  // ========================================
  // ARMAZENAMENTO
  // ========================================

  function ler(chave) {

    for (const guarda of guardas) {

      try {

        const valor = guarda.getItem(chave);

        if (valor) return valor;

      } catch {
        // Storage bloqueado
      }

    }

    return null;
  }

  function limpar() {

    for (const guarda of guardas) {

      try {

        guarda.removeItem(CHAVE_TOKEN);
        guarda.removeItem(CHAVE_USUARIO);

      } catch {
        // Ignora
      }

    }
  }

  // ========================================
  // VALIDAR TOKEN
  // ========================================

  function dadosDoToken(token) {

    try {

      const corpo = token
        .split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const json = decodeURIComponent(
        atob(corpo)
          .split('')
          .map(c =>
            '%' + c.charCodeAt(0)
              .toString(16)
              .padStart(2, '0')
          )
          .join('')
      );

      const dados = JSON.parse(json);

      return dados.exp && dados.exp * 1000 > Date.now()
        ? dados
        : null;

    } catch {
      return null;
    }
  }

  // ========================================
  // REDIRECIONAMENTO
  // ========================================

  let redirecionando = false;

  function irParaLogin() {

    if (redirecionando) return;

    redirecionando = true;

    limpar();

    document.documentElement.style.display = 'none';

    window.location.replace(URL_LOGIN);
  }

  // ========================================
  // VERIFICAR SESSÃO
  // ========================================

  const token = ler(CHAVE_TOKEN);

  const sessao = token
    ? dadosDoToken(token)
    : null;

  if (!sessao) {

    irParaLogin();

    return;
  }

  // ========================================
  // ENVIAR TOKEN AO BACKEND
  // ========================================

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (entrada, opcoes = {}) => {

    const endereco =
      typeof entrada === 'string'
        ? entrada
        : (entrada && entrada.url) || String(entrada);

    if (!endereco.startsWith(API)) {
      return fetchOriginal(entrada, opcoes);
    }

    const cabecalhos = new Headers(
      opcoes.headers ||
      (entrada instanceof Request ? entrada.headers : undefined)
    );

    cabecalhos.set(
      'Authorization',
      'Bearer ' + token
    );

    const resposta = await fetchOriginal(entrada, {
      ...opcoes,
      headers: cabecalhos
    });

    if (resposta.status === 401) {
      irParaLogin();
    }

    return resposta;
  };

  // ========================================
  // DADOS DO USUÁRIO LOGADO
  // ========================================

  window.sicepAuth = {

    usuario: {
      id: sessao.sub,
      nome: sessao.nome,
      email: sessao.email,
      cargo: sessao.cargo
    },

    sair: irParaLogin

  };

  // ========================================
  // EXPIRAÇÃO DA SESSÃO
  // ========================================

  setTimeout(
    irParaLogin,
    Math.max(sessao.exp * 1000 - Date.now(), 0)
  );

  // ========================================
  // ATUALIZAR MENU
  // ========================================

  document.addEventListener('DOMContentLoaded', () => {

    const menu = document.getElementById('sidebar');

    const rodape = menu && menu.lastElementChild;

    if (!rodape) return;

    // Apenas Desenvolvedor e Diretoria acessam usuários.

    if (!['desenvolvedor', 'diretoria'].includes(sessao.cargo)) {

      const itemUsuarios = menu.querySelector(
        'a[href="USUARIOS.HTML"]'
      );

      if (itemUsuarios) {
        (itemUsuarios.closest('li') || itemUsuarios).remove();
      }

    }

    const nome = sessao.nome || 'Usuário';

    const iniciais = nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || 'U';

    const cargos = {
      desenvolvedor: 'Desenvolvedor',
      diretoria: 'Diretoria',
      gerente: 'Gerente',
      coordenador: 'Coordenador',
      professor: 'Professor',
      assistente: 'Assistente'
    };

    const avatar = rodape.querySelector('.rounded-full');
    const titulo = rodape.querySelector('h4');
    const subtitulo = rodape.querySelector('p');

    if (avatar) avatar.textContent = iniciais;
    if (titulo) titulo.textContent = nome;

    if (subtitulo) {
      subtitulo.textContent =
        cargos[sessao.cargo] || sessao.cargo || '';
    }

    // Botão sair

    const botaoExistente = document.getElementById('btnSair');

    if (botaoExistente) return;

    const botao = document.createElement('button');

    botao.type = 'button';
    botao.id = 'btnSair';
    botao.dataset.ajuda = 'menu.sair';

    botao.className =
      'mt-4 w-full flex items-center justify-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 duration-200';

    botao.innerHTML =
      '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Sair</span>';

    botao.addEventListener('click', irParaLogin);

    rodape.appendChild(botao);

  });

})();