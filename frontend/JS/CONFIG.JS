// URL base da API usada pelo site.
// Local (localhost): backend Express em http://localhost:3000.
// Netlify: a funcao serverless responde em /api (mesmo dominio, sem CORS).
(function () {
  var local = ['localhost', '127.0.0.1', ''].indexOf(window.location.hostname) !== -1;
  window.SICEP_API_URL = local ? 'http://localhost:3000' : '/api';
})();
