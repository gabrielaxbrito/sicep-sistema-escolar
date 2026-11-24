// Campos adicionais permanecem na prévia até a futura integração do backend.
window.previaCursos = {
  listar() {
    try { return JSON.parse(sessionStorage.getItem('sicep.cursos.detalhes') || '{}'); }
    catch { return {}; }
  },
  obter(id) { return this.listar()[id] || {}; },
  salvar(id, dados) {
    sessionStorage.setItem('sicep.cursos.detalhes', JSON.stringify({ ...this.listar(), [id]: dados }));
  }
};
