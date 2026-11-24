const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

function openMenu() {
  sidebar.classList.remove("-translate-x-full");
  overlay.classList.remove("hidden");
}

function closeMenu() {
  sidebar.classList.add("-translate-x-full");
  overlay.classList.add("hidden");
}

menuBtn.addEventListener("click", openMenu);
overlay.addEventListener("click", closeMenu);
