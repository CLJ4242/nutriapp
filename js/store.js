// Persistance locale (localStorage, JSON). Échelle d'un foyer : largement suffisant.

const PREFIX = "nutriapp.";
const K = {
  aliments: PREFIX + "aliments",
  recettes: PREFIX + "recettes",
  foyer: PREFIX + "foyer",
  plan: PREFIX + "plan",
  courses: PREFIX + "courses"
};

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

function planVide() {
  const semaine = {};
  for (const jour of JOURS) {
    semaine[jour] = {};
    for (const t of TYPES_REPAS) {
      semaine[jour][t] = { recetteId: null, exception: false };
    }
  }
  return { semaine };
}

// Charge les bases seed depuis data/ au premier lancement.
export async function init() {
  if (!localStorage.getItem(K.aliments)) {
    const aliments = await fetch("data/aliments.json").then(r => r.json());
    ecrire(K.aliments, aliments);
  }
  if (!localStorage.getItem(K.recettes)) {
    const recettes = await fetch("data/recettes.json").then(r => r.json());
    ecrire(K.recettes, recettes);
  }
  if (!localStorage.getItem(K.foyer)) {
    ecrire(K.foyer, { personnes: [] });
  }
  if (!localStorage.getItem(K.plan)) {
    ecrire(K.plan, planVide());
  }
  if (!localStorage.getItem(K.courses)) {
    ecrire(K.courses, { coches: {} });
  }
}

export const getAliments = () => lire(K.aliments, []);
export const getRecettes = () => lire(K.recettes, []);
export const getFoyer = () => lire(K.foyer, { personnes: [] });
export const getPlan = () => lire(K.plan, planVide());
export const getCourses = () => lire(K.courses, { coches: {} });

export const setFoyer = f => ecrire(K.foyer, f);
export const setPlan = p => ecrire(K.plan, p);
export const setCourses = c => ecrire(K.courses, c);

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
