// Génération et validation du plan hebdomadaire.
import { JOURS, TYPES_REPAS, getPlan, getFoyer, getRecettes, alimentsById } from "./store.js";
import { recettesById } from "./store.js";
import { getRegime } from "./regimes/index.js";
import { analyseRecette, moisCourant, nomMois } from "./saison.js";

// Résout une case du plan en { typeRepas, recette, exception }.
function resoudreRepas(typeRepas, case_, recettesIdx) {
  return {
    typeRepas,
    recette: case_ && case_.recetteId ? recettesIdx[case_.recetteId] || null : null,
    exception: !!(case_ && case_.exception)
  };
}

// Une recette est-elle conforme au régime pour TOUS les profils du foyer ?
function conformeTousProfils(recette, foyer, ctxBase) {
  const repas = { typeRepas: recette.typeRepas, recette, exception: false };
  const ctx = { ...ctxBase, repasDuJour: {} };
  for (const personne of foyer.personnes) {
    const regime = getRegime(personne.regimeId);
    if (regime.valideRepas(repas, personne, ctx).violations.length > 0) return false;
  }
  return true;
}

// Valide tout le plan pour tous les profils du foyer.
// Renvoie { parJour: { [jour]: { messages:[{niveau, texte}] } }, nbViolations, nbAvertissements }.
export function validerPlan(options = {}) {
  const mois = options.mois || moisCourant();
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

    // Avertissements de saison (préférence du foyer, indépendants du régime).
    for (const t of TYPES_REPAS) {
      const repas = repasDuJour[t];
      if (!repas.recette) continue;
      const a = analyseRecette(repas.recette, ctxBase.alimentsById, mois);
      for (const nom of a.horsSaison) {
        messages.push({ niveau: "avertissement", texte: `${repas.recette.nom} — ${nom} hors saison en ${nomMois(mois)}` });
      }
      for (const nom of a.importes) {
        messages.push({ niveau: "avertissement", texte: `${repas.recette.nom} — ${nom} importé (non local)` });
      }
    }

    nbViolations += messages.filter(m => m.niveau === "violation").length;
    nbAvertissements += messages.filter(m => m.niveau === "avertissement").length;
    parJour[jour] = { messages };
  }

  return { parJour, nbViolations, nbAvertissements };
}

function choixAleatoire(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Recettes candidates pour un type de repas, conformes au régime de tous les
// profils, partitionnées selon la saison. { enSaison:[...], horsSaison:[...] }.
export function candidats(typeRepas, mois) {
  const foyer = getFoyer();
  const alIdx = alimentsById();
  const ctxBase = { alimentsById: alIdx };
  const enSaison = [];
  const horsSaison = [];
  for (const r of getRecettes()) {
    if (r.typeRepas !== typeRepas) continue;
    if (!conformeTousProfils(r, foyer, ctxBase)) continue;
    (analyseRecette(r, alIdx, mois).ok ? enSaison : horsSaison).push(r);
  }
  return { enSaison, horsSaison };
}

// Tire une recette pour un créneau : de saison en priorité, en évitant si
// possible les recettes déjà utilisées. Renvoie un recetteId ou null.
export function proposerRepas(typeRepas, mois, dejaUtilisees = new Set()) {
  const { enSaison, horsSaison } = candidats(typeRepas, mois);
  for (const pool of [enSaison, horsSaison]) {
    if (!pool.length) continue;
    const frais = pool.filter(r => !dejaUtilisees.has(r.id));
    const choix = choixAleatoire(frais.length ? frais : pool);
    return choix.id;
  }
  return null;
}

// Construit un plan hebdomadaire complet. { mois } par défaut = mois courant.
export function proposer(options = {}) {
  const mois = options.mois || moisCourant();
  const plan = getPlan();
  plan.mois = mois;
  const utilisees = {};
  for (const t of TYPES_REPAS) utilisees[t] = new Set();

  for (const jour of JOURS) {
    for (const t of TYPES_REPAS) {
      const id = proposerRepas(t, mois, utilisees[t]);
      if (id) utilisees[t].add(id);
      plan.semaine[jour][t] = { recetteId: id, exception: false };
    }
  }
  return plan;
}

export { getRecettes };
