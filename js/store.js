// Persistance locale (localStorage, JSON). Échelle d'un foyer : largement suffisant.

const PREFIX = "nutriapp.";
const K = {
  aliments: PREFIX + "aliments",            // seed (réécrit sur bump de SEED_VERSION)
  recettes: PREFIX + "recettes",            // seed
  alimentsUser: PREFIX + "aliments.user",   // ajoutés par l'utilisatrice (jamais écrasés)
  recettesUser: PREFIX + "recettes.user",   // idem
  typeOverride: PREFIX + "typeRepas",       // type de repas forcé par recette {id: type}
  masquerExemples: PREFIX + "masquerExemples",
  foyer: PREFIX + "foyer",
  plan: PREFIX + "plan",
  courses: PREFIX + "courses",
  seedVersion: PREFIX + "seedVersion"
};

// À incrémenter dès qu'on modifie data/aliments.json ou data/recettes.json :
// la base de référence est alors rechargée (le foyer et le plan sont conservés).
const SEED_VERSION = 6;

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const TYPES_REPAS = ["petit-dejeuner", "dejeuner", "collation", "diner"];
export const LIBELLE_REPAS = {
  "petit-dejeuner": "Petit-déjeuner",
  "dejeuner": "Déjeuner",
  "collation": "Collation",
  "diner": "Dîner"
};

function lire(cle, defaut) {
  const brut = localStorage.getItem(cle);
  if (brut === null) return defaut;
  try {
    return JSON.parse(brut);
  } catch {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  localStorage.setItem(cle, JSON.stringify(valeur));
}

// Identifiant court unique (réutilisé par l'UI).
export function uid(prefixe = "x") {
  return prefixe + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

function planVide() {
  const semaine = {};
  for (const jour of JOURS) {
    semaine[jour] = {};
    for (const t of TYPES_REPAS) {
      semaine[jour][t] = { recetteId: null, exception: false };
    }
  }
  return {
    semaine,
    mois: new Date().getMonth() + 1,
    mealPrep: true,
    variete: { "petit-dejeuner": 2, "dejeuner": 2, "collation": 2, "diner": 5 }
  };
}

// Charge les bases seed depuis data/ au premier lancement, et les rafraîchit
// quand SEED_VERSION change (sans toucher au foyer, au plan ni aux courses).
export async function init() {
  const versionStockee = Number(localStorage.getItem(K.seedVersion) || 0);
  const seedObsolete = versionStockee < SEED_VERSION;

  if (seedObsolete || !localStorage.getItem(K.aliments)) {
    const aliments = await fetch("data/aliments.json").then(r => r.json());
    ecrire(K.aliments, aliments);
  }
  if (seedObsolete || !localStorage.getItem(K.recettes)) {
    const recettes = await fetch("data/recettes.json").then(r => r.json());
    ecrire(K.recettes, recettes);
  }
  ecrire(K.seedVersion, SEED_VERSION);

  if (!localStorage.getItem(K.foyer)) {
    ecrire(K.foyer, { personnes: [] });
  } else {
    // Migration : l'ancien identifiant de régime « stef » devient « samaras ».
    const foyer = lire(K.foyer, { personnes: [] });
    let change = false;
    for (const p of foyer.personnes) {
      if (p.regimeId === "stef") { p.regimeId = "samaras"; change = true; }
    }
    if (change) ecrire(K.foyer, foyer);
  }
  if (!localStorage.getItem(K.plan)) {
    ecrire(K.plan, planVide());
  }
  if (!localStorage.getItem(K.courses)) {
    ecrire(K.courses, { coches: {} });
  }
  if (!localStorage.getItem(K.alimentsUser)) {
    ecrire(K.alimentsUser, []);
  }
  if (!localStorage.getItem(K.recettesUser)) {
    ecrire(K.recettesUser, []);
  }
  if (!localStorage.getItem(K.typeOverride)) {
    ecrire(K.typeOverride, {});
  }
}

// Getters fusionnés : seed + ajouts utilisateur (tagués source:"user").
export function getAliments() {
  const seed = lire(K.aliments, []).map(a => ({ ...a, source: "seed" }));
  const user = lire(K.alimentsUser, []).map(a => ({ ...a, source: "user" }));
  return [...seed, ...user];
}

// Types de repas autorisés pour une recette (liste), avec surcharge persistante.
function typesDe(r, override) {
  if (Array.isArray(override[r.id]) && override[r.id].length) return override[r.id].slice();
  if (Array.isArray(r.typesRepas) && r.typesRepas.length) return r.typesRepas.slice();
  return [r.typeRepas];
}

export function getRecettes() {
  const override = lire(K.typeOverride, {});
  const prep = (r, source) => ({ ...r, source, typesRepas: typesDe(r, override) });
  const user = lire(K.recettesUser, []).map(r => prep(r, "user"));
  if (lire(K.masquerExemples, false)) return user;
  const seed = lire(K.recettes, []).map(r => prep(r, "seed"));
  return [...seed, ...user];
}

// Force les types de repas d'une recette (surcharge, pour les exemples notamment).
export function setTypesRepas(recetteId, types) {
  const override = lire(K.typeOverride, {});
  override[recetteId] = types;
  ecrire(K.typeOverride, override);
}

export const getFoyer = () => lire(K.foyer, { personnes: [] });
export const getPlan = () => lire(K.plan, planVide());
export const getCourses = () => lire(K.courses, { coches: {} });

export const setFoyer = f => ecrire(K.foyer, f);
export const setPlan = p => ecrire(K.plan, p);
export const setCourses = c => ecrire(K.courses, c);

// Préférence d'affichage des recettes d'exemple.
export const getMasquerExemples = () => lire(K.masquerExemples, false);
export const setMasquerExemples = v => ecrire(K.masquerExemples, !!v);

// --- CRUD utilisateur (n'écrit QUE dans les tableaux user) ---

// Ajoute un aliment perso ; renvoie son id. Évite les doublons d'id.
export function ajouterAliment(aliment) {
  const user = lire(K.alimentsUser, []);
  const id = aliment.id || uid("al");
  const nouvel = { id, nom: aliment.nom, categorie: aliment.categorie, rayon: aliment.rayon, tags: aliment.tags || [] };
  user.push(nouvel);
  ecrire(K.alimentsUser, user);
  return id;
}

export function ajouterRecette(recette) {
  const user = lire(K.recettesUser, []);
  const id = recette.id || uid("rec");
  user.push({ ...recette, id, source: undefined });
  ecrire(K.recettesUser, user);
  return id;
}

export function modifierRecette(recette) {
  const user = lire(K.recettesUser, []);
  const i = user.findIndex(r => r.id === recette.id);
  if (i === -1) return false;
  user[i] = { ...recette, source: undefined };
  ecrire(K.recettesUser, user);
  return true;
}

export function supprimerRecette(id) {
  const user = lire(K.recettesUser, []);
  ecrire(K.recettesUser, user.filter(r => r.id !== id));
}

// Index pratiques.
export function alimentsById() {
  const idx = {};
  for (const al of getAliments()) idx[al.id] = al;
  return idx;
}

export function recettesById() {
  const idx = {};
  for (const r of getRecettes()) idx[r.id] = r;
  return idx;
}

export function reinitialiserPlan() {
  ecrire(K.plan, planVide());
}
