// Génération et validation du plan hebdomadaire.
import { JOURS, TYPES_REPAS, getPlan, getFoyer, getRecettes, alimentsById } from "./store.js";
import { recettesById } from "./store.js";
import { getRegime } from "./regimes/index.js";

// Résout une case du plan en { typeRepas, recette, exception }.
function resoudreRepas(typeRepas, case_, recettesIdx) {
  return {
    typeRepas,
    recette: case_ && case_.recetteId ? recettesIdx[case_.recetteId] || null : null,
    exception: !!(case_ && case_.exception)
  };
}

// Valide tout le plan pour tous les profils du foyer.
// Renvoie { parJour: { [jour]: { messages:[{niveau, texte}] } }, nbViolations, nbAvertissements }.
export function validerPlan() {
  const plan = getPlan();
  const foyer = getFoyer();
  const recettesIdx = recettesById();
  const ctxBase = { alimentsById: alimentsById() };

  const parJour = {};
  let nbViolations = 0;
  let nbAvertissements = 0;

  for (const jour of JOURS) {
    const messages = [];

    // Repas résolus de la journée (partagés par tous les profils en MVP).
    const repasDuJour = {};
    for (const t of TYPES_REPAS) {
      repasDuJour[t] = resoudreRepas(t, plan.semaine[jour][t], recettesIdx);
    }

    // Journée vide : on n'émet rien.
    const auMoinsUnRepas = TYPES_REPAS.some(t => repasDuJour[t].recette);

    for (const personne of foyer.personnes) {
      const regime = getRegime(personne.regimeId);
      const ctx = { ...ctxBase, repasDuJour };

      if (auMoinsUnRepas) {
        const jourRes = regime.valideJour(repasDuJour, personne, ctx);
        for (const v of jourRes.violations) {
          messages.push({ niveau: "violation", texte: `[${personne.nom}] ${v}` });
        }
        for (const w of jourRes.avertissements) {
          messages.push({ niveau: "avertissement", texte: `[${personne.nom}] ${w}` });
        }
      }

      for (const t of TYPES_REPAS) {
        const repas = repasDuJour[t];
        if (!repas.recette) continue;
        const res = regime.valideRepas(repas, personne, ctx);
        for (const v of res.violations) {
          messages.push({
            niveau: "violation",
            texte: `[${personne.nom}] ${repas.recette.nom} — ${v}`
          });
        }
        for (const w of res.avertissements) {
          messages.push({
            niveau: "avertissement",
            texte: `[${personne.nom}] ${repas.recette.nom} — ${w}`
          });
        }
      }
    }

    nbViolations += messages.filter(m => m.niveau === "violation").length;
    nbAvertissements += messages.filter(m => m.niveau === "avertissement").length;
    parJour[jour] = { messages };
  }

  return { parJour, nbViolations, nbAvertissements };
}

// Signature prête pour l'auto-génération (phase ultérieure, non implémentée).
export function proposer(/* foyer, recettes, contraintes */) {
  throw new Error("Auto-génération non encore implémentée.");
}

export { getRecettes };
