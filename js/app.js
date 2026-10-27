// Bootstrap : init du store, navigation par onglets, enregistrement du service worker.
import { init } from "./store.js";
import { afficher } from "./ui.js";

const ONGLETS = [
  ["foyer", "Foyer"],
  ["aliments", "Aliments"],
  ["recettes", "Recettes"],
  ["plan", "Plan"],
  ["courses", "Courses"]
];

async function demarrer() {
  await init();

  const nav = document.getElementById("nav");
  const vue = document.getElementById("vue");

  function aller(cle) {
    afficher(cle, vue);
    for (const b of nav.children) {
      b.classList.toggle("actif", b.dataset.vue === cle);
    }
    location.hash = cle;
    vue.scrollIntoView({ block: "start" });
  }

  for (const [cle, libelle] of ONGLETS) {
    const b = document.createElement("button");
    b.textContent = libelle;
    b.dataset.vue = cle;
    b.addEventListener("click", () => aller(cle));
    nav.appendChild(b);
  }

  const initiale = (location.hash || "#foyer").slice(1);
  aller(ONGLETS.some(o => o[0] === initiale) ? initiale : "foyer");
}

// Service worker (installabilité + offline).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* ignoré en dev */ });
  });
}

demarrer();
