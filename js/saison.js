// Saisonnalité suisse. Préférence (pas un interdit) : on signale et on évite,
// mais on ne bloque jamais. Calendrier porté par le champ `saison` des aliments
// (tableau de mois 1–12) ; le tag `import` = non cultivé en Suisse ; sans `saison`
// ni `import` = disponible toute l'année (épicerie, protéines, laitiers…).

export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

export function moisCourant() {
  return new Date().getMonth() + 1;
}

export function nomMois(m) {
  return MOIS[(m - 1 + 12) % 12];
}

// "import" | "hors-saison" | "de-saison" | "toujours"
export function statut(aliment, mois) {
  if (aliment.tags && aliment.tags.includes("import")) return "import";
  if (Array.isArray(aliment.saison)) {
    return aliment.saison.includes(mois) ? "de-saison" : "hors-saison";
  }
  return "toujours";
}

// Vrai si l'aliment convient à la saison (de saison ou dispo toute l'année).
export function estBienDeSaison(aliment, mois) {
  const s = statut(aliment, mois);
  return s === "de-saison" || s === "toujours";
}

// Analyse une recette : ingrédients problématiques pour le mois.
export function analyseRecette(recette, alimentsById, mois) {
  const horsSaison = [];
  const importes = [];
  if (recette) {
    for (const ing of recette.ingredients) {
      const al = alimentsById[ing.alimentId];
      if (!al) continue;
      const s = statut(al, mois);
      if (s === "import") importes.push(al.nom);
      else if (s === "hors-saison") horsSaison.push(al.nom);
    }
  }
  return { horsSaison, importes, ok: horsSaison.length === 0 && importes.length === 0 };
}

// Regroupe des mois consécutifs en intervalles lisibles (gère le passage déc→jan).
function intervalles(mois) {
  const set = [...mois].sort((a, b) => a - b);
  if (set.length === 12) return null; // toute l'année
  // fusion circulaire : on détecte les coupures
  const presents = new Set(set);
  // point de départ = premier mois dont le précédent est absent
  let depart = set.find(m => !presents.has(m === 1 ? 12 : m - 1));
  if (depart === undefined) depart = set[0];
  const ordre = [];
  for (let i = 0; i < 12; i++) {
    const m = ((depart - 1 + i) % 12) + 1;
    if (presents.has(m)) ordre.push(m);
  }
  const segs = [];
  let deb = ordre[0], prev = ordre[0];
  for (let i = 1; i < ordre.length; i++) {
    const m = ordre[i];
    const attendu = (prev % 12) + 1;
    if (m === attendu) { prev = m; continue; }
    segs.push([deb, prev]); deb = m; prev = m;
  }
  segs.push([deb, prev]);
  return segs;
}

// Texte court pour l'UI.
export function libelleSaison(aliment) {
  if (aliment.tags && aliment.tags.includes("import")) return "importé";
  if (!Array.isArray(aliment.saison)) return "toute l'année";
  const segs = intervalles(aliment.saison);
  if (segs === null) return "toute l'année";
  return segs
    .map(([a, b]) => a === b ? nomMois(a) : `${nomMois(a)}–${nomMois(b)}`)
    .join(", ");
}
