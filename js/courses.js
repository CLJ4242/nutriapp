// Génération de la liste de courses à partir du plan de la semaine.
import { JOURS, TYPES_REPAS, getPlan, getFoyer, alimentsById, recettesById } from "./store.js";

const LIBELLE_RAYON = {
  "fruits-legumes": "Fruits & légumes",
  "boucherie-poissonnerie": "Boucherie / Poissonnerie",
  "cremerie": "Crèmerie",
  "epicerie-salee": "Épicerie salée",
  "epicerie-sucree": "Épicerie sucrée",
  "boulangerie": "Boulangerie",
  "boissons": "Boissons",
  "surgeles": "Surgelés",
  "autre": "Autre"
};

// Renvoie [{ rayon, libelle, lignes:[{cle, nom, qte, unite}] }] trié par rayon.
export function genererCourses() {
  const plan = getPlan();
  const foyer = getFoyer();
  const alIdx = alimentsById();
  const recIdx = recettesById();
  const nbConvives = Math.max(1, foyer.personnes.length);

  // Agrégation par (aliment, unité).
  const agg = {};
  for (const jour of JOURS) {
    for (const t of TYPES_REPAS) {
      const case_ = plan.semaine[jour][t];
      const recette = case_ && case_.recetteId ? recIdx[case_.recetteId] : null;
      if (!recette) continue;
      for (const ing of recette.ingredients) {
        const al = alIdx[ing.alimentId];
        if (!al) continue;
        const cle = ing.alimentId + "|" + ing.unite;
        if (!agg[cle]) {
          agg[cle] = { cle, alimentId: al.id, nom: al.nom, rayon: al.rayon, qte: 0, unite: ing.unite };
        }
        agg[cle].qte += ing.qteParPersonne * nbConvives;
      }
    }
  }

  // Regroupement par rayon.
  const parRayon = {};
  for (const ligne of Object.values(agg)) {
    const rayon = ligne.rayon || "autre";
    if (!parRayon[rayon]) parRayon[rayon] = [];
    parRayon[rayon].push(ligne);
  }

  return Object.keys(parRayon)
    .sort((a, b) => (LIBELLE_RAYON[a] || a).localeCompare(LIBELLE_RAYON[b] || b))
    .map(rayon => ({
      rayon,
      libelle: LIBELLE_RAYON[rayon] || rayon,
      lignes: parRayon[rayon].sort((a, b) => a.nom.localeCompare(b.nom))
    }));
}
