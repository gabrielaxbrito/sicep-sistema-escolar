const usuarios = window.previaUsuarios.listar();
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
  document.getElementById('sucessoMsg').classList.add('hidden');
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
    linha.className = 'hover:bg-gray-50 duration-150';
    [usuario.nome, usuario.email, cargos[usuario.cargo]].forEach((valor, indice) => {
      const celula = document.createElement('td');
      celula.className = `px-6 py-4 text-sm ${indice === 0 ? 'font-medium text-gray-800' : 'text-gray-600'}`;
      celula.textContent = valor;
      linha.append(celula);
    });
    const acoes = document.createElement('td');
    acoes.className = 'px-6 py-4 text-sm';
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'text-[#07224f] font-semibold rounded-md px-3 py-2 hover:bg-gray-100';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', `Editar ${usuario.nome}`);
    editar.addEventListener('click', () => abrirUsuario(usuario));
    acoes.append(editar);
    linha.append(acoes);
    tabela.append(linha);
  });
}

usuarioForm.addEventListener('submit', event => {
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
  else if (usuarios.some(usuario => usuario !== usuarioEmEdicao && usuario.email === email)) erro = 'Já existe um usuário com este e-mail nesta sessão.';
  if (erro) {
    erroMsg.textContent = erro;
    erroMsg.classList.remove('hidden');
    return;
  }
  // Prévia visual: a senha nunca é copiada para a lista ou persistida.
  const editando = Boolean(usuarioEmEdicao);
  const dados = { nome, email, cargo };
  if (professor) Object.assign(dados, { telefone: mascararTelefone(telefone), especialidade });
  if (usuarioEmEdicao) {
    delete usuarioEmEdicao.telefone;
    delete usuarioEmEdicao.especialidade;
    Object.assign(usuarioEmEdicao, dados);
  } else usuarios.push(dados);
  window.previaUsuarios.salvar(usuarios);
  fecharCadastro();
  buscaUsuarios.value = '';
  renderizarUsuarios();
  const sucesso = document.getElementById('sucessoMsg');
  sucesso.textContent = editando ? 'Usuário atualizado na prévia desta sessão.' : 'Usuário adicionado à prévia desta sessão.';
  sucesso.classList.remove('hidden');
});
buscaUsuarios.addEventListener('input', renderizarUsuarios);
atualizarCamposProfessor();
renderizarUsuarios();
