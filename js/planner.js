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

// Une recette contient-elle un aliment exclu par ce profil ? (indépendant du régime)
export function alimentsExclus(recette, personne) {
  if (!recette || !personne || !personne.exclus || !personne.exclus.length) return [];
  return recette.ingredients
    .map(i => i.alimentId)
    .filter(id => personne.exclus.includes(id));
}

// Une recette est-elle conforme (exclusions + régime) pour TOUS les profils ?
function conformeTousProfils(recette, foyer, ctxBase) {
  const repas = { typeRepas: recette.typeRepas, recette, exception: false };
  const ctx = { ...ctxBase, repasDuJour: {} };
  for (const personne of foyer.personnes) {
    if (alimentsExclus(recette, personne).length > 0) return false;
    const regime = getRegime(personne.regimeId);
    if (regime.valideRepas(repas, personne, ctx).violations.length > 0) return false;
  }
  return true;
}

// Conformité d'une recette vis-à-vis du foyer courant (pour filtrer l'UI).
export function recetteConforme(recette) {
  return conformeTousProfils(recette, getFoyer(), { alimentsById: alimentsById() });
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
        // Exclusions personnelles (indépendantes du régime).
        for (const id of alimentsExclus(repas.recette, personne)) {
          const al = ctxBase.alimentsById[id];
          messages.push({
            niveau: "violation",
            texte: `[${personne.nom}] ${repas.recette.nom} — ${al ? al.nom : id} est exclu`
          });
        }
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
    const types = r.typesRepas || [r.typeRepas];
    if (!types.includes(typeRepas)) continue;
    if (!conformeTousProfils(r, foyer, ctxBase)) continue;
    (analyseRecette(r, alIdx, mois).ok ? enSaison : horsSaison).push(r);
  }
  return { enSaison, horsSaison };
}

// Une recette est « simple » sauf si marquée effort:"cuisine" (plats élaborés).
const estSimple = r => r.effort !== "cuisine";

// Candidats ordonnés par préférence (meilleur d'abord) : de saison avant
// hors-saison ; et pour le dîner, simple avant élaboré (dîners sobres).
function candidatsOrdonnes(typeRepas, mois) {
  const { enSaison, horsSaison } = candidats(typeRepas, mois);
  const ordonner = pool => typeRepas === "diner"
    ? [...melanger(pool.filter(estSimple)), ...melanger(pool.filter(r => !estSimple(r)))]
    : melanger(pool);
  return [...ordonner(enSaison), ...ordonner(horsSaison)];
}

// Tire une recette pour un créneau (re-tirage d'un seul repas). Renvoie un id ou null.
export function proposerRepas(typeRepas, mois, dejaUtilisees = new Set()) {
  const ordre = candidatsOrdonnes(typeRepas, mois);
  if (!ordre.length) return null;
  const frais = ordre.filter(r => !dejaUtilisees.has(r.id));
  return (frais[0] || ordre[0]).id;
}

// Choisit jusqu'à k recettes distinctes pour un type de repas.
function choisirPlats(typeRepas, mois, k) {
  const ordre = candidatsOrdonnes(typeRepas, mois);
  return ordre.slice(0, k).map(r => r.id);
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

// Variété par défaut : meal prep le midi, plus varié le soir.
const VARIETE_DEFAUT = { "petit-dejeuner": 2, "dejeuner": 2, "collation": 2, "diner": 5 };

// Normalise l'option variété en objet {typeRepas: nombre}.
export function normaliserVariete(v) {
  if (typeof v === "number") {
    const o = {};
    for (const t of TYPES_REPAS) o[t] = v;
    return o;
  }
  return { ...VARIETE_DEFAUT, ...(v && typeof v === "object" ? v : {}) };
}

// Construit un plan hebdomadaire complet.
// options = { mois, variete, mealPrep }.
// - mealPrep (défaut true) : peu de plats distincts, répétés en blocs.
// - mealPrep false : un plat différent chaque jour (variété maximale).
export function proposer(options = {}) {
  const mois = options.mois || moisCourant();
  const mealPrep = options.mealPrep !== false;
  const variete = mealPrep
    ? normaliserVariete(options.variete)
    : { "petit-dejeuner": 7, "dejeuner": 7, "collation": 7, "diner": 7 };
  const plan = getPlan();
  plan.mois = mois;
  plan.mealPrep = mealPrep;
  if (mealPrep) plan.variete = variete;

  for (const t of TYPES_REPAS) {
    const k = Math.max(1, variete[t] || 2);
    const ids = choisirPlats(t, mois, k);
    const parJour = repartirBlocs(ids, JOURS.length);
    JOURS.forEach((jour, i) => {
      // On préserve les repas marqués « dehors » (restaurant / cheat).
      if (plan.semaine[jour][t] && plan.semaine[jour][t].dehors) return;
      plan.semaine[jour][t] = { recetteId: parJour[i], exception: false };
    });
  }
  return plan;
}

// Remplace les repas devenus non conformes (ex. aliment exclu ajouté après coup),
// sans toucher aux repas valides ni aux repas « dehors ». Renvoie true si modifié.
export function assainir(plan, mois) {
  const m = mois || plan.mois || moisCourant();
  const foyer = getFoyer();
  const ctxBase = { alimentsById: alimentsById() };
  const recById = recettesById();
  const utilisees = {};
  for (const t of TYPES_REPAS) utilisees[t] = new Set();
  for (const jour of JOURS) for (const t of TYPES_REPAS) {
    const id = plan.semaine[jour][t].recetteId;
    if (id) utilisees[t].add(id);
  }
  let change = false;
  for (const jour of JOURS) {
    for (const t of TYPES_REPAS) {
      const case_ = plan.semaine[jour][t];
      if (case_.dehors || !case_.recetteId) continue;
      const r = recById[case_.recetteId];
      if (!r || !conformeTousProfils(r, foyer, ctxBase)) {
        const nouvel = proposerRepas(t, m, utilisees[t]);
        case_.recetteId = nouvel;
        if (nouvel) utilisees[t].add(nouvel);
        change = true;
      }
    }
  }
  return change;
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
