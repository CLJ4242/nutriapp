// Génération et validation du plan hebdomadaire.
import { JOURS, TYPES_REPAS, getPlan, getFoyer, getRecettes, alimentsById } from "./store.js";
import { recettesById } from "./store.js";
import { getRegime } from "./regimes/index.js";
import { analyseRecette, moisCourant, nomMois } from "./saison.js";

// Résout une case du plan en { typeRepas, recette, exception, dehors }.
function resoudreRepas(typeRepas, case_, recettesIdx) {
  return {
    typeRepas,
    recette: case_ && case_.recetteId ? recettesIdx[case_.recetteId] || null : null,
    exception: !!(case_ && case_.exception),
    dehors: !!(case_ && case_.dehors)
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

function melanger(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// Tire une recette pour un créneau (re-tirage d'un seul repas) : de saison en
// priorité, en évitant si possible les recettes exclues. Renvoie un id ou null.
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

// Choisit jusqu'à k recettes distinctes pour un type de repas (de saison en
// priorité, complétées hors-saison si besoin pour atteindre la variété).
function choisirPlats(typeRepas, mois, k) {
  const { enSaison, horsSaison } = candidats(typeRepas, mois);
  const choisis = melanger(enSaison).slice(0, k);
  if (choisis.length < k) {
    for (const r of melanger(horsSaison)) {
      if (choisis.length >= k) break;
      choisis.push(r);
    }
  }
  return choisis.map(r => r.id);
}

// Répartit k plats sur n jours en blocs contigus (meal prep).
function repartirBlocs(ids, n) {
  if (!ids.length) return new Array(n).fill(null);
  const out = [];
  const base = Math.floor(n / ids.length);
  let reste = n % ids.length;
  for (const id of ids) {
    let count = base + (reste > 0 ? 1 : 0);
    if (reste > 0) reste--;
    for (let i = 0; i < count; i++) out.push(id);
  }
  return out;
}

// Construit un plan hebdomadaire complet, orienté « meal prep » :
// peu de plats distincts par type de repas, répétés en blocs sur la semaine.
// options = { mois, variete } ; variete = nb de plats distincts par repas (défaut 2).
export function proposer(options = {}) {
  const mois = options.mois || moisCourant();
  const variete = Math.max(1, options.variete || 2);
  const plan = getPlan();
  plan.mois = mois;
  plan.variete = variete;

  for (const t of TYPES_REPAS) {
    const ids = choisirPlats(t, mois, variete);
    const parJour = repartirBlocs(ids, JOURS.length);
    JOURS.forEach((jour, i) => {
      // On préserve les repas marqués « dehors » (restaurant / cheat).
      if (plan.semaine[jour][t] && plan.semaine[jour][t].dehors) return;
      plan.semaine[jour][t] = { recetteId: parJour[i], exception: false };
    });
  }
  return plan;
}

// Vrai si le plan ne contient aucune recette (pour l'auto-remplissage).
export function planVide(plan) {
  const p = plan || getPlan();
  for (const jour of JOURS) {
    for (const t of TYPES_REPAS) {
      if (p.semaine[jour][t] && p.semaine[jour][t].recetteId) return false;
    }
  }
  return true;
}

export { getRecettes };
