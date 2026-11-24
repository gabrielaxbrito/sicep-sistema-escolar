const API = String(window.SICEP_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
let usuarios = [];
const meuId = window.sicepAuth?.usuario?.id;
const modalUsuario = document.getElementById('modalUsuario');
const usuarioForm = document.getElementById('usuarioForm');
const nomeInput = document.getElementById('nome');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const cargoInput = document.getElementById('cargo');
const camposProfessor = document.getElementById('camposProfessor');
const telefoneInput = document.getElementById('telefone');
const especialidadeInput = document.getElementById('especialidade');
let usuarioEmEdicao = null;

function mascararTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (!digitos) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  const numero = digitos.slice(2);
  const corte = numero.length > 8 ? 5 : 4;
  return `(${digitos.slice(0, 2)}) ${numero.slice(0, corte)}${numero.length > corte ? '-' + numero.slice(corte) : ''}`;
}

function atualizarCamposProfessor() {
  const professor = cargoInput.value === 'professor';
  camposProfessor.hidden = !professor;
  camposProfessor.disabled = !professor;
  telefoneInput.required = professor;
  especialidadeInput.required = professor;
  telefoneInput.setCustomValidity('');
  especialidadeInput.setCustomValidity('');
}

cargoInput.addEventListener('change', atualizarCamposProfessor);
telefoneInput.addEventListener('input', () => {
  telefoneInput.value = mascararTelefone(telefoneInput.value);
  telefoneInput.setCustomValidity('');
});
especialidadeInput.addEventListener('input', () => especialidadeInput.setCustomValidity(''));
const cargos = {
  desenvolvedor: 'Desenvolvedor',
  diretoria: 'Diretoria',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  professor: 'Professor',
  assistente: 'Assistente'
};
const buscaUsuarios = document.getElementById('buscaInput');
const erroMsg = document.getElementById('erroMsg');
const mostrarSenha = document.getElementById('mostrarSenha');
let focoAnterior;

function ocultarSenha() {
  senhaInput.type = 'password';
  mostrarSenha.setAttribute('aria-label', 'Mostrar senha');
  mostrarSenha.setAttribute('aria-pressed', 'false');
  mostrarSenha.firstElementChild.className = 'fa-regular fa-eye';
}

function fecharCadastro() {
  modalUsuario.classList.add('hidden');
  modalUsuario.classList.remove('flex');
  usuarioForm.reset();
  usuarioEmEdicao = null;
  atualizarCamposProfessor();
  ocultarSenha();
  focoAnterior?.focus();
}

function abrirUsuario(usuario = null) {
  focoAnterior = document.activeElement;
  usuarioForm.reset();
  usuarioEmEdicao = usuario;
  if (usuario) {
    nomeInput.value = usuario.nome;
    emailInput.value = usuario.email;
    cargoInput.value = usuario.cargo;
    telefoneInput.value = mascararTelefone(usuario.telefone || '');
    especialidadeInput.value = usuario.especialidade || '';
  }
  atualizarCamposProfessor();
  senhaInput.required = !usuario;
  document.getElementById('modalTitulo').textContent = usuario ? 'Editar usuário' : 'Novo usuário';
  usuarioForm.querySelector('button[type="submit"]').textContent = usuario ? 'Salvar alterações' : 'Cadastrar usuário';
  document.getElementById('senhaAjuda').textContent = usuario ? 'Preencha apenas para alterar a senha. Use pelo menos 8 caracteres.' : 'Use pelo menos 8 caracteres.';
  document.querySelector('label[for="senha"] span').hidden = Boolean(usuario);
  erroMsg.classList.add('hidden');
  sucessoMsg.classList.add('hidden');
  ocultarSenha();
  modalUsuario.classList.remove('hidden');
  modalUsuario.classList.add('flex');
  nomeInput.focus();
}
document.getElementById('novoUsuarioBtn').addEventListener('click', () => abrirUsuario());
document.getElementById('closeModal').addEventListener('click', fecharCadastro);
document.getElementById('cancelModal').addEventListener('click', fecharCadastro);
modalUsuario.addEventListener('click', event => {
  if (event.target === modalUsuario) fecharCadastro();
});
modalUsuario.addEventListener('keydown', event => {
  if (event.key === 'Escape') fecharCadastro();
  if (event.key !== 'Tab') return;
  const campos = [...modalUsuario.querySelectorAll('button, input, select')].filter(campo => !campo.matches(':disabled') && !campo.closest('[hidden]'));
  const primeiro = campos[0];
  const ultimo = campos[campos.length - 1];
  if (event.shiftKey && document.activeElement === primeiro) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primeiro.focus();
  }
});
mostrarSenha.addEventListener('click', () => {
  const mostrar = senhaInput.type === 'password';
  senhaInput.type = mostrar ? 'text' : 'password';
  mostrarSenha.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  mostrarSenha.setAttribute('aria-pressed', String(mostrar));
  mostrarSenha.firstElementChild.className = mostrar ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

// Chamada ao servidor: devolve os dados ou lança um erro com a mensagem do servidor.
async function chamar(caminho, metodo = 'GET', corpo) {
  let resposta;
  try {
    resposta = await fetch(API + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.error || 'Algo deu errado. Tente novamente.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

const listaMsg = document.getElementById('listaMsg');
const sucessoMsg = document.getElementById('sucessoMsg');

function mostrarErroLista(texto) {
  listaMsg.textContent = texto;
  listaMsg.classList.toggle('hidden', !texto);
}

function mostrarSucesso(texto) {
  sucessoMsg.textContent = texto;
  sucessoMsg.classList.remove('hidden');
}

function criarBotaoAcao(texto, classe, rotulo, aoClicar) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = classe;
  botao.textContent = texto;
  botao.setAttribute('aria-label', rotulo);
  botao.addEventListener('click', aoClicar);
  return botao;
}

function renderizarUsuarios() {
  const busca = buscaUsuarios.value.trim().toLocaleLowerCase('pt-BR');
  const filtrados = usuarios.filter(usuario =>
    `${usuario.nome} ${usuario.email} ${cargos[usuario.cargo]}`.toLocaleLowerCase('pt-BR').includes(busca));
  document.getElementById('totalUsuarios').textContent = `${filtrados.length} usuário${filtrados.length === 1 ? '' : 's'} encontrado${filtrados.length === 1 ? '' : 's'}`;
  document.getElementById('emptyState').classList.toggle('hidden', filtrados.length > 0);
  document.getElementById('tableWrapper').classList.toggle('hidden', filtrados.length === 0);
  const tabela = document.getElementById('tabelaUsuarios');
  tabela.replaceChildren();
  filtrados.forEach(usuario => {
    const linha = document.createElement('tr');
    linha.className = `hover:bg-gray-50 duration-150${usuario.ativo ? '' : ' bg-gray-50/60'}`;
    const souEu = usuario.id === meuId;
    [usuario.nome + (souEu ? ' (você)' : ''), usuario.email, cargos[usuario.cargo]].forEach((valor, indice) => {
      const celula = document.createElement('td');
      const cor = !usuario.ativo ? 'text-gray-400' : indice === 0 ? 'font-medium text-gray-800' : 'text-gray-600';
      celula.className = `px-6 py-4 text-sm ${cor}`;
      celula.textContent = valor;
      linha.append(celula);
    });

    const situacao = document.createElement('td');
    situacao.className = 'px-6 py-4 text-sm';
    const selo = document.createElement('span');
    selo.className = `inline-block rounded-full px-3 py-1 text-xs font-semibold ${usuario.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'}`;
    selo.textContent = usuario.ativo ? 'Ativo' : 'Inativo';
    situacao.append(selo);
    linha.append(situacao);

    const acoes = document.createElement('td');
    acoes.className = 'px-6 py-4 text-sm whitespace-nowrap';
    acoes.append(criarBotaoAcao('Editar', 'text-[#07224f] font-semibold rounded-md px-3 py-2 hover:bg-gray-100', `Editar ${usuario.nome}`, () => abrirUsuario(usuario)));
    if (!souEu) {
      acoes.append(criarBotaoAcao(
        usuario.ativo ? 'Desativar' : 'Reativar',
        `font-semibold rounded-md px-3 py-2 hover:bg-gray-100 ${usuario.ativo ? 'text-red-600' : 'text-green-700'}`,
        `${usuario.ativo ? 'Desativar' : 'Reativar'} ${usuario.nome}`,
        () => alternarAtivo(usuario)
      ));
    }
    linha.append(acoes);
    tabela.append(linha);
  });
}

async function carregarUsuarios() {
  try {
    usuarios = await chamar('/usuarios');
    mostrarErroLista('');
  } catch (erro) {
    usuarios = [];
    mostrarErroLista(erro.message);
    if (erro.status === 403) document.getElementById('novoUsuarioBtn').classList.add('hidden');
  }
  renderizarUsuarios();
}

async function alternarAtivo(usuario) {
  sucessoMsg.classList.add('hidden');
  try {
    await chamar(`/usuarios/${usuario.id}/ativo`, 'PATCH', { ativo: !usuario.ativo });
    await carregarUsuarios();
    mostrarSucesso(usuario.ativo ? `${usuario.nome} foi desativado e não consegue mais entrar.` : `${usuario.nome} foi reativado.`);
  } catch (erro) {
    mostrarErroLista(erro.message);
  }
}

usuarioForm.addEventListener('submit', async event => {
  event.preventDefault();
  const nome = nomeInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const cargo = cargoInput.value;
  const professor = cargo === 'professor';
  const telefone = telefoneInput.value.replace(/\D/g, '');
  const especialidade = especialidadeInput.value.trim();
  if (professor) {
    telefoneInput.setCustomValidity(/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(telefone) ? '' : 'Informe um telefone válido com DDD (10 ou 11 dígitos).');
    especialidadeInput.setCustomValidity(especialidade ? '' : 'Informe a especialidade do professor.');
  }
  if (!usuarioForm.reportValidity()) return;
  let erro = '';
  if (!nome) erro = 'Informe o nome do usuário.';
  else if (!Object.hasOwn(cargos, cargo)) erro = 'Selecione um cargo válido.';
  if (erro) {
    erroMsg.textContent = erro;
    erroMsg.classList.remove('hidden');
    return;
  }

  const editando = Boolean(usuarioEmEdicao);
  const dados = { nome, email, cargo };
  if (senhaInput.value) dados.senha = senhaInput.value;
  if (professor) Object.assign(dados, { telefone, especialidade });

  const botaoSalvar = usuarioForm.querySelector('button[type="submit"]');
  const textoOriginal = botaoSalvar.textContent;
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = 'Salvando...';
  erroMsg.classList.add('hidden');

  try {
    await chamar(editando ? `/usuarios/${usuarioEmEdicao.id}` : '/usuarios', editando ? 'PUT' : 'POST', dados);
  } catch (falha) {
    erroMsg.textContent = falha.message;
    erroMsg.classList.remove('hidden');
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = textoOriginal;
    return;
  }

  botaoSalvar.disabled = false;
  fecharCadastro();
  buscaUsuarios.value = '';
  await carregarUsuarios();
  mostrarSucesso(editando ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
});
buscaUsuarios.addEventListener('input', renderizarUsuarios);
atualizarCamposProfessor();
carregarUsuarios();
