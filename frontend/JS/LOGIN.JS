document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  document.getElementById("loginStatus").textContent =
    "O login ainda não está disponível. Clique em Acessar dashboard para continuar sem autenticação.";
});
