// Compartilha apenas dados públicos da prévia entre páginas na mesma aba.
window.previaUsuarios = {
  listar() {
    try {
      const dados = JSON.parse(sessionStorage.getItem('sicep.usuarios') || '[]');
      return Array.isArray(dados) ? dados : [];
    } catch { return []; }
  },
  salvar(usuarios) {
    sessionStorage.setItem('sicep.usuarios', JSON.stringify(usuarios.map(({ nome, email, cargo, telefone, especialidade }) => ({ nome, email, cargo, telefone, especialidade }))));
  }
};
