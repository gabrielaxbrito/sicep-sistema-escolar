const API = String(window.SICEP_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const CHAVE_TOKEN = 'sicep.token';
const CHAVE_USUARIO = 'sicep.usuario';
const DESTINO = 'HTML/DASHBOARD.HTML';

const form = document.getElementById('loginForm');
const status = document.getElementById('loginStatus');
const botao = form.querySelector('button[type="submit"]');

function mostrar(texto, tipo) {
  status.textContent = texto;
  status.className = 'status' + (tipo ? ' ' + tipo : '');
}

// Se já existe uma sessão válida, vai direto para o sistema.
function sessaoValida() {
  for (const guarda of [window.localStorage, window.sessionStorage]) {
    try {
      const token = guarda.getItem(CHAVE_TOKEN);
      if (!token) continue;
      const corpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const dados = JSON.parse(atob(corpo));
      if (dados.exp && dados.exp * 1000 > Date.now()) return true;
    } catch { /* token inválido: ignora */ }
  }
  return false;
}

if (sessaoValida()) window.location.replace(DESTINO);

document.querySelector('.forgot').addEventListener('click', (evento) => {
  evento.preventDefault();
  mostrar('Para redefinir a senha, peça a um administrador do sistema.', '');
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const lembrar = document.getElementById('lembrar').checked;

  botao.disabled = true;
  botao.textContent = 'Entrando...';
  mostrar('', '');

  try {
    const resposta = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      mostrar(dados.error || 'Não foi possível entrar. Tente novamente.', 'erro');
      return;
    }

    // "Lembrar de mim" guarda a sessão no navegador; sem isso ela vale só até fechar a aba.
    const guarda = lembrar ? window.localStorage : window.sessionStorage;
    const outra = lembrar ? window.sessionStorage : window.localStorage;
    outra.removeItem(CHAVE_TOKEN);
    outra.removeItem(CHAVE_USUARIO);
    guarda.setItem(CHAVE_TOKEN, dados.token);
    guarda.setItem(CHAVE_USUARIO, JSON.stringify(dados.usuario));

    mostrar('Login realizado! Entrando...', 'ok');
    window.location.replace(DESTINO);
  } catch {
    mostrar('Não foi possível conectar ao servidor. Verifique se o backend está rodando (npm run dev).', 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});
