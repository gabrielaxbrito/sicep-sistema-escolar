// Define a URL da API no ambiente local e no Netlify.
(() => {
  const localSeparado = location.protocol === 'file:' ||
    (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && location.port !== '8888');
  window.SICEP_API_URL = String(window.SICEP_API_URL ||
    (localSeparado ? 'http://localhost:3000' : '/api')).replace(/\/+$/, '');
})();
