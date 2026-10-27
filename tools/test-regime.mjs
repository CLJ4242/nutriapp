// Test rapide du moteur de règles (hors navigateur). Usage : node tools/test-regime.mjs
import { readFileSync } from "node:fs";
import stef from "../js/regimes/stef.js";

const aliments = JSON.parse(readFileSync(new URL("../data/aliments.json", import.meta.url)));
const recettes = JSON.parse(readFileSync(new URL("../data/recettes.json", import.meta.url)));
const alimentsById = Object.fromEntries(aliments.map(a => [a.id, a]));
const recById = Object.fromEntries(recettes.map(r => [r.id, r]));

const profil = { nom: "Stef", regimeId: "stef", exclus: [] };
let echecs = 0;
function verifie(nom, cond) {
  console.log((cond ? "✓" : "✗") + " " + nom);
  if (!cond) echecs++;
}

// 1) Pâtes au dîner -> violation (interdit après 17h)
let r = stef.valideRepas(
  { typeRepas: "diner", recette: recById["din-pates-interdit"], exception: false },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Pâtes au dîner = violation", r.violations.some(v => /interdit après 17h/.test(v)));

// 2) Même repas avec exception -> pas de violation, un avertissement
r = stef.valideRepas(
  { typeRepas: "diner", recette: recById["din-pates-interdit"], exception: true },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Pâtes au dîner + exception = pas de violation", r.violations.length === 0);

// 3) Dîner conforme (cabillaud + légumes)
r = stef.valideRepas(
  { typeRepas: "diner", recette: recById["din-cabillaud-legumes"], exception: false },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Dîner cabillaud+légumes = conforme", r.violations.length === 0);

// 4) Collation conforme (protéine + fibre)
r = stef.valideRepas(
  { typeRepas: "collation", recette: recById["col-skyr-amandes"], exception: false },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Collation skyr+amandes = conforme", r.violations.length === 0);

// 5) Petit-déj bol conforme
r = stef.valideRepas(
  { typeRepas: "petit-dejeuner", recette: recById["pdj-bol"], exception: false },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Petit-déj bol = conforme", r.violations.length === 0);

// 6) Petit-déj tartines conforme
r = stef.valideRepas(
  { typeRepas: "petit-dejeuner", recette: recById["pdj-tartines"], exception: false },
  profil, { alimentsById, repasDuJour: {} }
);
verifie("Petit-déj tartines = conforme", r.violations.length === 0);

// 7) Collation manquante -> valideJour violation
r = stef.valideJour(
  { "collation": { recette: null } },
  profil, { alimentsById }
);
verifie("Collation manquante = violation", r.violations.some(v => /obligatoire/.test(v)));

// 8) Aliment exclu du profil -> violation
r = stef.valideRepas(
  { typeRepas: "diner", recette: recById["din-cabillaud-legumes"], exception: false },
  { nom: "X", regimeId: "stef", exclus: ["cabillaud"] }, { alimentsById, repasDuJour: {} }
);
verifie("Aliment exclu = violation", r.violations.some(v => /exclu/.test(v)));

console.log(echecs === 0 ? "\nTous les tests passent." : `\n${echecs} test(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
